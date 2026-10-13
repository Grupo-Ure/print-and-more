// email-webhook — the provider's delivery reports.
//
// Hours after the sender got a mail accepted, Resend reports what became of
// it. This function is the endpoint those reports are posted to: it verifies
// that the report is Resend's (the Svix signature against
// RESEND_WEBHOOK_SECRET — there is no Supabase session to check, so
// verify_jwt is off for this one function), finds the sent mail's record by
// the provider's id, and marks it.
//
//   email.delivered   → sent_emails.delivered_at
//   email.bounced     → sent_emails.bounced_at + bounce_reason, an EMAIL_BOUNCED
//                       entry on the order's history, and customers.email_bounced_at
//                       when the mail went to the customer's current address
//   email.complained  → sent_emails.complained_at
//
// Every other event type is acknowledged and ignored. So is a report whose
// record cannot be found — the mail went out from another environment, or
// from a database since reset — and a report delivered twice: the record is
// marked once, and the history entry written once. Resend retries a report
// that is not answered 2xx, so anything that is not a signature failure or a
// crash answers 200. A bounce is never retried: the address is the problem.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from './signature.ts'

/** The provider id the sender records when it runs with EMAIL_DRY_RUN=true; no report ever carries it. */
const DRY_RUN_PROVIDER_ID = 'dry-run'

type ReportType = 'email.delivered' | 'email.bounced' | 'email.complained'

const HANDLED_TYPES: ReadonlySet<string> = new Set<ReportType>(['email.delivered', 'email.bounced', 'email.complained'])

/** What Resend's bounce report says about the bounce. */
interface BounceDetail {
  message: string | null
  type: string | null
  subType: string | null
}

/** One delivery report, as far as this function reads it. */
interface DeliveryReport {
  type: ReportType
  /** When the provider recorded the event; the record is stamped with it. */
  occurredAt: string
  /** Resend's id of the mail — the sender stored it as sent_emails.provider_id. */
  emailId: string
  bounce: BounceDetail | null
}

/** The sent mail's record, with the order's customer for the bounce flag. */
interface SentEmailRecord {
  id: string
  order_id: string
  product_id: string | null
  template: string
  recipient: string
  delivered_at: string | null
  bounced_at: string | null
  complained_at: string | null
  orders: { customer_id: string } | { customer_id: string }[] | null
}

type Outcome = 'marked' | 'already_marked' | 'unknown_email' | 'ignored_type'

function requiredVariable(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`email-webhook: ${name} is not set`)
  return value
}

// Read once, when the function starts, so a missing secret shows on deploy
// rather than on the first report.
const WEBHOOK_SECRET = requiredVariable('RESEND_WEBHOOK_SECRET')

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── The report ────────────────────────────────────────────────────────────────

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** A timestamp the provider sent, or now when it is missing or unreadable. */
function occurredAt(value: unknown): string {
  const raw = stringOrNull(value)
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : new Date().toISOString()
}

/**
 * Resend's event envelope: `{ type, created_at, data: { email_id, …, bounce? } }`.
 * Null when the body is not one; a handled type with no `email_id` is
 * malformed and also null.
 */
function parseReport(raw: string): { report: DeliveryReport | null; type: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { report: null, type: null }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { report: null, type: null }

  const { type, created_at, data } = parsed as Record<string, unknown>
  const eventType = stringOrNull(type)
  if (!eventType || !HANDLED_TYPES.has(eventType)) return { report: null, type: eventType }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { report: null, type: eventType }

  const { email_id, bounce } = data as Record<string, unknown>
  const emailId = stringOrNull(email_id)
  if (!emailId) return { report: null, type: eventType }

  let bounceDetail: BounceDetail | null = null
  if (typeof bounce === 'object' && bounce !== null && !Array.isArray(bounce)) {
    const { message, type: bounceType, subType } = bounce as Record<string, unknown>
    bounceDetail = { message: stringOrNull(message), type: stringOrNull(bounceType), subType: stringOrNull(subType) }
  }

  return {
    report: { type: eventType as ReportType, occurredAt: occurredAt(created_at), emailId, bounce: bounceDetail },
    type: eventType,
  }
}

// ── The record ────────────────────────────────────────────────────────────────

const RECORD_COLUMNS = 'id, order_id, product_id, template, recipient, delivered_at, bounced_at, complained_at, orders(customer_id)'

/** The newest record carrying the provider's id — one, outside a dry run. */
async function findRecord(db: SupabaseClient, emailId: string): Promise<SentEmailRecord | null> {
  if (emailId === DRY_RUN_PROVIDER_ID) return null
  const { data, error } = await db
    .from('sent_emails')
    .select(RECORD_COLUMNS)
    .eq('provider_id', emailId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`sent_emails lookup failed: ${error.message}`)
  return data as SentEmailRecord | null
}

function customerIdOf(record: SentEmailRecord): string | null {
  const orders = Array.isArray(record.orders) ? (record.orders[0] ?? null) : record.orders
  return orders?.customer_id ?? null
}

async function stamp(db: SupabaseClient, record: SentEmailRecord, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('sent_emails').update(patch).eq('id', record.id)
  if (error) throw new Error(`sent_emails update failed: ${error.message}`)
}

/** The provider's reason, or its classification when it sent no wording. */
function bounceReason(bounce: BounceDetail | null): string {
  if (bounce?.message) return bounce.message
  const classification = [bounce?.type, bounce?.subType].filter(Boolean).join(' / ')
  return classification || 'Bounced'
}

async function writeBounceHistory(db: SupabaseClient, record: SentEmailRecord, report: DeliveryReport, reason: string): Promise<void> {
  const { error } = await db.from('history').insert({
    order_id: record.order_id,
    product_id: record.product_id,
    event_type: 'EMAIL_BOUNCED',
    user_id: null,
    meta: {
      template: record.template,
      recipient: record.recipient,
      reason,
      bounce_type: report.bounce?.type ?? null,
      bounce_sub_type: report.bounce?.subType ?? null,
      sent_email_id: record.id,
      provider_id: report.emailId,
    },
  })
  if (error) throw new Error(`history EMAIL_BOUNCED failed: ${error.message}`)
}

/**
 * Flags the customer's address when the bounced mail went to it. A customer
 * who has changed address since the mail went out is not flagged for the old
 * one — the trigger that clears the flag on a change says the same thing.
 */
async function flagCustomerAddress(db: SupabaseClient, record: SentEmailRecord, bouncedAt: string): Promise<void> {
  const customerId = customerIdOf(record)
  if (!customerId) return
  const { error } = await db
    .from('customers')
    .update({ email_bounced_at: bouncedAt })
    .eq('id', customerId)
    .ilike('email', record.recipient)
  if (error) throw new Error(`customers flag failed: ${error.message}`)
}

async function applyReport(db: SupabaseClient, report: DeliveryReport): Promise<Outcome> {
  const record = await findRecord(db, report.emailId)
  if (!record) {
    console.warn('email-webhook: no record for the reported mail', { type: report.type, emailId: report.emailId })
    return 'unknown_email'
  }

  switch (report.type) {
    case 'email.delivered': {
      if (record.delivered_at) return 'already_marked'
      await stamp(db, record, { delivered_at: report.occurredAt })
      return 'marked'
    }
    case 'email.complained': {
      if (record.complained_at) return 'already_marked'
      await stamp(db, record, { complained_at: report.occurredAt })
      return 'marked'
    }
    case 'email.bounced': {
      if (record.bounced_at) return 'already_marked'
      const reason = bounceReason(report.bounce)
      await stamp(db, record, { bounced_at: report.occurredAt, bounce_reason: reason })
      await writeBounceHistory(db, record, report, reason)
      await flagCustomerAddress(db, record, report.occurredAt)
      return 'marked'
    }
  }
}

// ── The endpoint ──────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    // The raw text, not req.json(): the signature covers the bytes as sent.
    const body = await req.text()
    const verdict = await verifyWebhookSignature(WEBHOOK_SECRET, req.headers, body)
    if (!verdict.ok) {
      console.warn('email-webhook: report refused', { reason: verdict.reason })
      return json(401, { error: 'Invalid signature', reason: verdict.reason })
    }

    const { report, type } = parseReport(body)
    if (!report) {
      // Signed by Resend, so acknowledged — a type this function does not
      // handle, or a shape it does not read. Not an error to retry.
      console.info('email-webhook: report ignored', { type })
      return json(200, { outcome: 'ignored_type' satisfies Outcome, type })
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const outcome = await applyReport(db, report)
    return json(200, { outcome, type: report.type })
  } catch (error) {
    console.error('email-webhook: report failed', error)
    return json(500, { error: errorText(error) })
  }
})
