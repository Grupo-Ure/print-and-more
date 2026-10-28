// node:fs must be the first import of a function that reads static files, so
// no other module brings its own file-system polyfill (Supabase's guidance
// for static_files).
import 'node:fs'

// send-email — the email sender.
//
// One action, `drain`, called by the drain cron every ten seconds (and by the
// e2e suite directly): claim the due messages, and for each one — still
// needed? → resolve → render → send → record → archive. The service-role key
// is the only accepted caller; the cron sends it, nothing else should.
//
// A message carries ids, not a mail. Its template's module looks the
// recipient and the data up at send time, so the mail goes out with today's
// details. What the sender writes: a sent_emails row and an EMAIL_SENT
// history entry when the provider accepts; an EMAIL_FAILED history entry when
// the attempts are spent; nothing at all when a refused send still has tries
// left — the message stays claimed and comes back when its visibility timeout
// lapses. Every path ends by archiving the message, except the one that
// leaves it to come back.

import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { renderEmail, type RenderedEmail, type Wording } from './render.ts'
import {
  TEMPLATES,
  isTemplateName,
  type EmailMessage,
  type ResolvedEmail,
  type TemplateDeps,
  type TemplateName,
} from './templates/registry.ts'
import type { SendError, Transport } from '../_shared/emailProvider.ts'
import { transportFromEnv } from '../_shared/emailProviderFromEnv.ts'

/** How long a claimed message stays invisible to other claims; a crashed sender hands it back after this. */
const QUEUE_VISIBILITY_SECONDS = 30

/** How many due messages one drain claims. */
const CLAIM_BATCH_SIZE = 20

/** The claim on which a refused send is given up on and EMAIL_FAILED written. */
const MAX_ATTEMPTS = 5

const SECONDS_PER_DAY = 86_400

/** One row of claim_emails: pgmq's message record. */
interface ClaimedMessage {
  msg_id: number
  read_ct: number
  enqueued_at: string
  vt: string
  message: unknown
}

/** What became of one claimed message. */
type Outcome = 'sent' | 'skipped' | 'failed' | 'retried'

interface DrainSummary {
  claimed: number
  /** Accepted by the provider, recorded, archived. */
  sent: number
  /** Archived unsent: not needed any more, order gone, or malformed. */
  skipped: number
  /** Given up on: archived with EMAIL_FAILED. */
  failed: number
  /** Refused with tries left: left on the queue to come back. */
  retried: number
}

const transport: Transport = transportFromEnv('send-email')

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── Caller check ──────────────────────────────────────────────────────────────

/**
 * Only the service-role key may drain. The gateway has already checked that
 * the bearer token is a valid JWT; this checks that it is *that* one, so a
 * signed-in user's session is refused.
 */
function isServiceRoleCall(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  const presented = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  if (expected.length === 0 || presented.length !== expected.length) return false
  return timingSafeEqual(presented, expected)
}

async function readAction(req: Request): Promise<string | null> {
  const raw = await req.text()
  if (raw.trim() === '') return null
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const { action } = parsed as Record<string, unknown>
  return typeof action === 'string' ? action : null
}

// ── The message ───────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The queue payload as queue_email shapes it, or null when it is not one. */
function parseMessage(raw: unknown): EmailMessage | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const { template, order_id, product_id, context } = raw as Record<string, unknown>
  if (typeof template !== 'string' || template === '') return null
  if (typeof order_id !== 'string' || !UUID_RE.test(order_id)) return null
  if (product_id !== null && product_id !== undefined && (typeof product_id !== 'string' || !UUID_RE.test(product_id))) return null
  const safeContext =
    typeof context === 'object' && context !== null && !Array.isArray(context) ? (context as Record<string, unknown>) : {}
  return { template, order_id, product_id: product_id ?? null, context: safeContext }
}

// ── Queue and record ──────────────────────────────────────────────────────────

async function archive(db: SupabaseClient, msgId: number): Promise<void> {
  const { error } = await db.rpc('archive_email', { msg_id: msgId })
  if (error) throw new Error(`archive_email(${msgId}) failed: ${error.message}`)
}

async function orderExists(db: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await db.from('orders').select('id').eq('id', orderId).maybeSingle()
  if (error) throw new Error(`order lookup failed: ${error.message}`)
  return data !== null
}

async function writeHistory(
  db: SupabaseClient,
  message: EmailMessage,
  eventType: 'EMAIL_SENT' | 'EMAIL_FAILED',
  meta: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('history').insert({
    order_id: message.order_id,
    product_id: message.product_id,
    event_type: eventType,
    user_id: null,
    meta: { template: message.template, ...meta },
  })
  if (error) throw new Error(`history ${eventType} failed: ${error.message}`)
}

/**
 * Writes the record and its history entry. A row for this message already
 * being there means a previous attempt was accepted but crashed before
 * archiving; the record stands and nothing is written twice.
 */
async function recordSent(
  db: SupabaseClient,
  msgId: number,
  message: EmailMessage,
  recipient: string,
  rendered: RenderedEmail,
  providerId: string,
): Promise<void> {
  const { data, error } = await db
    .from('sent_emails')
    .insert({
      queue_msg_id: msgId,
      template: message.template,
      order_id: message.order_id,
      product_id: message.product_id,
      recipient,
      subject: rendered.subject,
      body_html: rendered.html,
      body_text: rendered.text,
      provider_id: providerId,
    })
    .select('id')
    .single()
  if (error) {
    // 23505: unique_violation on queue_msg_id — already recorded.
    if (error.code === '23505') return
    throw new Error(`sent_emails insert failed: ${error.message}`)
  }
  await writeHistory(db, message, 'EMAIL_SENT', {
    recipient,
    subject: rendered.subject,
    provider_id: providerId,
    sent_email_id: data.id,
  })
}

/** A template's row in email_settings (Settings → Emails), as far as the sender reads it: its switches and its wording. */
interface TemplateSettings extends Wording {
  is_enabled: boolean
  repeat_days: number | null
  max_sends: number
}

/** The template's settings, or null when it has no row — a mail with no wording, which is given up. */
async function loadSettings(db: SupabaseClient, template: string): Promise<TemplateSettings | null> {
  const { data, error } = await db
    .from('email_settings')
    .select('is_enabled, repeat_days, max_sends, subject, body')
    .eq('template', template)
    .maybeSingle()
  if (error) throw new Error(`email_settings lookup failed: ${error.message}`)
  return data
}

/**
 * A repeating template (email_settings.repeat_days set) gets its next message
 * queued now, due in repeat_days, as long as this one's sequence number is
 * below max_sends. The first message of a series has no sequence and counts
 * as 1. Whether the next one is still wanted when it comes due is for the
 * template's stillNeeded to say.
 */
async function queueRepeat(db: SupabaseClient, message: EmailMessage, settings: TemplateSettings): Promise<void> {
  if (settings.repeat_days === null) return

  const sequence = typeof message.context.sequence === 'number' ? message.context.sequence : 1
  if (sequence >= settings.max_sends) return

  const { error: queueError } = await db.rpc('queue_email', {
    template: message.template,
    order_id: message.order_id,
    product_id: message.product_id,
    context: { ...message.context, sequence: sequence + 1 },
    delay_seconds: settings.repeat_days * SECONDS_PER_DAY,
  })
  if (queueError) throw new Error(`queue_email (repeat) failed: ${queueError.message}`)
}

/**
 * Decided after the attempt, not on claim, so the history entry carries the
 * actual refusal: spent attempts archive the message with EMAIL_FAILED;
 * otherwise nothing is written and the visibility timeout brings it back.
 */
async function handleRefusal(
  db: SupabaseClient,
  claimed: ClaimedMessage,
  message: EmailMessage,
  recipient: string | null,
  error: SendError,
): Promise<Outcome> {
  if (claimed.read_ct < MAX_ATTEMPTS) {
    console.warn('send-email: refused, will retry', { msgId: claimed.msg_id, attempt: claimed.read_ct, error })
    return 'retried'
  }
  console.error('send-email: giving up', { msgId: claimed.msg_id, attempts: claimed.read_ct, error })
  await writeHistory(db, message, 'EMAIL_FAILED', { recipient, attempts: claimed.read_ct, error })
  await archive(db, claimed.msg_id)
  return 'failed'
}

// ── One message ───────────────────────────────────────────────────────────────

async function processMessage(db: SupabaseClient, claimed: ClaimedMessage): Promise<Outcome> {
  const message = parseMessage(claimed.message)
  if (!message) {
    // Not a request queue_email could have written; there is no order to
    // write a history entry against, so the log is the record.
    console.error('send-email: malformed message archived', { msgId: claimed.msg_id, message: claimed.message })
    await archive(db, claimed.msg_id)
    return 'skipped'
  }

  if (!isTemplateName(message.template)) {
    await writeHistory(db, message, 'EMAIL_FAILED', { reason: 'unknown_template' })
    await archive(db, claimed.msg_id)
    return 'failed'
  }
  // Narrowed by the guard above; the type guard does not carry into the object.
  const templateName = message.template as TemplateName
  const template = TEMPLATES[templateName]
  const deps: TemplateDeps = { db }

  // Switched off in Settings since it was queued: a mail that is off is not
  // sent, whether it was waiting already or not (queue_email stops new ones).
  const settings = await loadSettings(db, message.template)
  if (settings && !settings.is_enabled) {
    console.info('send-email: template switched off, message archived', { msgId: claimed.msg_id, template: message.template })
    await archive(db, claimed.msg_id)
    return 'skipped'
  }

  // The order was deleted between queuing and sending: nothing to send about,
  // and nothing to record against.
  if (!(await orderExists(db, message.order_id))) {
    console.warn('send-email: order gone, message archived', { msgId: claimed.msg_id, orderId: message.order_id })
    await archive(db, claimed.msg_id)
    return 'skipped'
  }

  // A template without a row has no wording to send; the migration that adds
  // a mail adds its row, so this is a mail added without one.
  if (!settings) {
    await writeHistory(db, message, 'EMAIL_FAILED', { reason: 'no_settings_row' })
    await archive(db, claimed.msg_id)
    return 'failed'
  }

  if (template.stillNeeded && !(await template.stillNeeded(message, deps))) {
    await archive(db, claimed.msg_id)
    return 'skipped'
  }

  let resolved: ResolvedEmail
  try {
    resolved = await template.resolve(message, deps)
  } catch (error) {
    // Looking the data up failed; counted like a refusal so a transient cause
    // gets its retries and a lasting one ends in EMAIL_FAILED.
    return handleRefusal(db, claimed, message, null, { code: 'resolve_failed', message: errorText(error), status: null })
  }
  const { recipient } = resolved

  let rendered: RenderedEmail
  try {
    rendered = renderEmail(templateName, settings, resolved.data)
  } catch (error) {
    // The wording uses a slot the data has no value for, or does not parse.
    // Another try renders the same text, so the mail is given up at once.
    console.error('send-email: wording does not render, giving up', { msgId: claimed.msg_id, error: errorText(error) })
    await writeHistory(db, message, 'EMAIL_FAILED', { reason: 'render_failed', recipient, error: errorText(error) })
    await archive(db, claimed.msg_id)
    return 'failed'
  }

  const outcome = await transport.send({
    to: recipient,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: `email/${claimed.msg_id}`,
    tags: { order_id: message.order_id, template: message.template },
    dryRunRefuse: message.context.dry_run_refuse === true,
  })
  if (!outcome.ok) {
    return handleRefusal(db, claimed, message, recipient, outcome.error)
  }

  await recordSent(db, claimed.msg_id, message, recipient, rendered, outcome.providerId)
  await queueRepeat(db, message, settings)
  await archive(db, claimed.msg_id)
  return 'sent'
}

// ── The drain ─────────────────────────────────────────────────────────────────

async function drain(db: SupabaseClient): Promise<DrainSummary> {
  const { data, error } = await db.rpc('claim_emails', {
    visibility_seconds: QUEUE_VISIBILITY_SECONDS,
    batch_size: CLAIM_BATCH_SIZE,
  })
  if (error) throw new Error(`claim_emails failed: ${error.message}`)

  // The RPC's rows are untyped here; claim_emails returns pgmq's message record.
  const claimed = (data ?? []) as ClaimedMessage[]
  const summary: DrainSummary = { claimed: claimed.length, sent: 0, skipped: 0, failed: 0, retried: 0 }

  for (const claimedMessage of claimed) {
    try {
      const outcome = await processMessage(db, claimedMessage)
      summary[outcome] += 1
    } catch (error) {
      // A write failed mid-way; the message stays claimed and comes back when
      // its visibility timeout lapses.
      console.error('send-email: message left to come back', { msgId: claimedMessage.msg_id, error: errorText(error) })
      summary.retried += 1
    }
  }
  return summary
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!isServiceRoleCall(req)) return json(401, { error: 'send-email accepts the service-role key only' })

  try {
    const action = await readAction(req)
    if (action !== 'drain') return json(400, { error: 'Unknown action' })

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const summary = await drain(db)
    return json(200, { ...summary })
  } catch (error) {
    console.error('send-email: drain failed', error)
    return json(500, { error: errorText(error) })
  }
})
