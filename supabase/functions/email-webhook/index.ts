// email-webhook — the provider's delivery reports.
//
// Hours after the sender got a mail accepted, the provider reports what
// became of it. This function is the endpoint those reports are posted to:
// the provider's report reader verifies the signature against
// EMAIL_WEBHOOK_SECRET (there is no Supabase session to check, so verify_jwt
// is off for this one function) and reads the report into our own shape; this
// function finds the sent mail's record by the provider's id, and marks it.
//
//   delivered   → sent_emails.delivered_at
//   bounced     → sent_emails.bounced_at + bounce_reason, bounce_classification,
//                 bounce_status_code
//   complained  → sent_emails.complained_at
//
// What a bounce means for an order — the EMAIL_BOUNCED history entry, the flag
// on the customer's address — is not this function's: a trigger on the bounce
// stamp writes it for a mail about an order.
//
// Every other event type is acknowledged and ignored. So is a report whose
// record cannot be found — the mail went out from another environment, or
// from a database since reset — and a report delivered twice: the record is
// marked once. The provider retries a
// report that is not answered 2xx, so anything that is not a signature
// failure or a crash answers 200. A bounce is never retried: the address is
// the problem.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DRY_RUN_PROVIDER_ID, type BounceDetail, type DeliveryReport } from '../_shared/emailProvider.ts'
import { reportReaderFromEnv } from '../_shared/emailProviderFromEnv.ts'

/** The sent mail's record, as far as the stamps go. */
interface SentEmailRecord {
  id: string
  delivered_at: string | null
  bounced_at: string | null
  complained_at: string | null
}

type Outcome = 'marked' | 'already_marked' | 'unknown_email' | 'ignored_type'

const reportReader = reportReaderFromEnv('email-webhook')

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── The record ────────────────────────────────────────────────────────────────

const RECORD_COLUMNS = 'id, delivered_at, bounced_at, complained_at'

/** The newest record carrying the provider's id — one, outside a dry run. */
async function findRecord(db: SupabaseClient, providerId: string): Promise<SentEmailRecord | null> {
  if (providerId === DRY_RUN_PROVIDER_ID) return null
  const { data, error } = await db
    .from('sent_emails')
    .select(RECORD_COLUMNS)
    .eq('provider_id', providerId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`sent_emails lookup failed: ${error.message}`)
  return data as SentEmailRecord | null
}

async function stamp(db: SupabaseClient, record: SentEmailRecord, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('sent_emails').update(patch).eq('id', record.id)
  if (error) throw new Error(`sent_emails update failed: ${error.message}`)
}

/** The provider's reason, or its classification when it sent no wording. */
function bounceReason(bounce: BounceDetail | null): string {
  return bounce?.reason ?? bounce?.classification ?? 'Bounced'
}

async function applyReport(db: SupabaseClient, report: DeliveryReport): Promise<Outcome> {
  const record = await findRecord(db, report.providerId)
  if (!record) {
    console.warn('email-webhook: no record for the reported mail', { event: report.event, providerId: report.providerId })
    return 'unknown_email'
  }

  switch (report.event) {
    case 'delivered': {
      if (record.delivered_at) return 'already_marked'
      await stamp(db, record, { delivered_at: report.occurredAt })
      return 'marked'
    }
    case 'complained': {
      if (record.complained_at) return 'already_marked'
      await stamp(db, record, { complained_at: report.occurredAt })
      return 'marked'
    }
    case 'bounced': {
      if (record.bounced_at) return 'already_marked'
      await stamp(db, record, {
        bounced_at: report.occurredAt,
        bounce_reason: bounceReason(report.bounce),
        bounce_classification: report.bounce?.classification ?? null,
        bounce_status_code: report.bounce?.statusCode ?? null,
      })
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
    const read = await reportReader.read(req.headers, body)
    if (!read.ok) {
      console.warn('email-webhook: report refused', { reason: read.reason })
      return json(401, { error: 'Invalid signature', reason: read.reason })
    }

    const { report, type } = read
    if (!report) {
      // Signed by the provider, so acknowledged — a type this function does
      // not handle, or a shape it does not read. Not an error to retry.
      console.info('email-webhook: report ignored', { type })
      return json(200, { outcome: 'ignored_type' satisfies Outcome, type })
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const outcome = await applyReport(db, report)
    return json(200, { outcome, type })
  } catch (error) {
    console.error('email-webhook: report failed', error)
    return json(500, { error: errorText(error) })
  }
})
