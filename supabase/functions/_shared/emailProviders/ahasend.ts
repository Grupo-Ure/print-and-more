// AhaSend — the email provider. Everything that knows AhaSend's API is in
// this file: the send request, its answer, the webhook's signature and its
// event payload. The references it is written against are in
// docs/reference/ahasend/ (create-message.md, webhooks.yaml, node-sdk.md).
//
// Sending: one POST per mail to /v2/accounts/{account_id}/messages, with the
// mail's idempotency key as the Idempotency-Key header (AhaSend replays a
// stored answer for 24 hours, so a retried send is delivered once). An
// accepted request answers 202 with one entry per recipient, and that entry
// can still be a refusal (`status: 'error'`, a suppressed address for
// instance) — the 202 alone is not an acceptance. The mail's id is the
// entry's `id`, the generated Message-ID (`<uuid@host>`); reports name the
// mail by the same value in `data.message_id_header`. No `substitutions` are
// sent, so AhaSend renders nothing: the bodies go out as send-email rendered
// them.
//
// Reports: signed as Standard Webhooks do — webhook-id, webhook-timestamp and
// webhook-signature headers, an HMAC-SHA256 over `<id>.<timestamp>.<raw body>`
// with `v1,<base64>` entries — except for the key, which is the secret's own
// UTF-8 bytes, `aha-whsec-` prefix included, never base64-decoded.
//
// Free of Deno globals and imports: the e2e suite loads this file under Node
// to sign the reports it posts (encodeReport).

import type {
  BounceDetail,
  DeliveryEvent,
  DeliveryReport,
  OutgoingMail,
  ProviderSettings,
  ReadOutcome,
  ReportReader,
  SendError,
  SendOutcome,
  SignedReport,
  Transport,
} from '../emailProvider.ts'

const API_BASE_URL = 'https://api.ahasend.com'

/** How far a report's timestamp may lie from now, in seconds (AhaSend's own verifier's default). */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

const SIGNATURE_VERSION = 'v1'

/** AhaSend's event types for the three events the webhook acts on. */
const EVENT_BY_TYPE: Readonly<Record<string, DeliveryEvent>> = {
  'message.delivered': 'delivered',
  'message.bounced': 'bounced',
  'message.complained': 'complained',
}

const TYPE_BY_EVENT: Readonly<Record<DeliveryEvent, string>> = {
  delivered: 'message.delivered',
  bounced: 'message.bounced',
  complained: 'message.complained',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** `Name <address>` or a bare address, as EMAIL_FROM and EMAIL_REPLY_TO hold them. */
function parseAddress(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (!match) return { email: value.trim() }
  const name = match[1].replace(/^"(.*)"$/, '$1')
  return name ? { email: match[2].trim(), name } : { email: match[2].trim() }
}

function base64(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function sign(secret: string, content: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content)))
}

/** Compares in time independent of where the strings differ. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

// ── Sending ───────────────────────────────────────────────────────────────────

/** Our reading of an HTTP refusal; AhaSend's own wording is kept as the message. */
function errorForStatus(status: number, message: string): SendError {
  if (status === 401 || status === 403) return { code: 'unauthorized', message, status }
  if (status === 409) return { code: 'conflict', message, status }
  if (status === 429) return { code: 'rate_limited', message, status }
  if (status >= 500) return { code: 'provider_error', message, status }
  return { code: 'rejected', message, status }
}

async function refusalMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.message === 'string') return body.message
  } catch {
    // Not JSON; the status says enough.
  }
  return `AhaSend answered ${response.status}`
}

/** Reads EMAIL_API_KEY, EMAIL_ACCOUNT_ID, EMAIL_FROM and EMAIL_REPLY_TO once, when the function starts. */
export function createTransport(settings: ProviderSettings): Transport {
  const apiKey = settings.required('EMAIL_API_KEY')
  const accountId = settings.required('EMAIL_ACCOUNT_ID')
  const from = parseAddress(settings.required('EMAIL_FROM'))
  const replyTo = settings.optional('EMAIL_REPLY_TO')
  const url = `${API_BASE_URL}/v2/accounts/${encodeURIComponent(accountId)}/messages`

  return {
    async send(mail: OutgoingMail): Promise<SendOutcome> {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': mail.idempotencyKey,
          },
          body: JSON.stringify({
            from,
            recipients: [{ email: mail.to }],
            subject: mail.subject,
            html_content: mail.html,
            text_content: mail.text,
            ...(replyTo ? { reply_to: parseAddress(replyTo) } : {}),
            tags: Object.entries(mail.tags).map(([name, value]) => `${name}:${value}`),
          }),
        })
      } catch (error) {
        return {
          ok: false,
          error: { code: 'network_error', message: error instanceof Error ? error.message : String(error), status: null },
        }
      }

      if (!response.ok) {
        return { ok: false, error: errorForStatus(response.status, await refusalMessage(response)) }
      }

      let body: unknown
      try {
        body = await response.json()
      } catch {
        body = null
      }
      const entry = isRecord(body) && Array.isArray(body.data) ? body.data[0] : undefined
      if (!isRecord(entry)) {
        return {
          ok: false,
          error: { code: 'empty_response', message: 'AhaSend answered without a message entry', status: response.status },
        }
      }
      const id = stringOrNull(entry.id)
      if (entry.status === 'error' || !id) {
        return {
          ok: false,
          error: { code: 'rejected', message: stringOrNull(entry.error) ?? 'AhaSend refused the recipient', status: response.status },
        }
      }
      return { ok: true, providerId: id }
    },
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

/** The three headers a signed report carries, or null when one is missing. */
function signatureHeaders(headers: Headers): { id: string; timestamp: string; signature: string } | null {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signature = headers.get('webhook-signature')
  if (!id || !timestamp || !signature) return null
  return { id, timestamp, signature }
}

/**
 * Whether the report really came from the endpoint's owner, and recently. The
 * signature header may carry several space-separated `v1,<base64>` entries (a
 * rotated secret adds one); any one matching is enough. A report older or
 * newer than the tolerance is refused, so a captured one cannot be replayed.
 */
async function verify(secret: string, headers: Headers, body: string, nowMs: number): Promise<string | null> {
  const presented = signatureHeaders(headers)
  if (!presented) return 'missing_signature_headers'

  const timestamp = Number(presented.timestamp)
  if (!Number.isInteger(timestamp)) return 'malformed_timestamp'
  if (Math.abs(nowMs / 1000 - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) return 'timestamp_out_of_tolerance'

  const expected = await sign(secret, `${presented.id}.${presented.timestamp}.${body}`)
  const candidates = presented.signature
    .split(' ')
    .map(entry => entry.split(',', 2))
    .filter(([version]) => version === SIGNATURE_VERSION)
    .map(([, value]) => value ?? '')
  return candidates.some(candidate => constantTimeEquals(expected, candidate)) ? null : 'signature_mismatch'
}

/** A timestamp the provider sent, or now when it is missing or unreadable. */
function occurredAt(value: unknown): string {
  const raw = stringOrNull(value)
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : new Date().toISOString()
}

/**
 * A bounce's `delivery_attempt`: present for a direct SMTP rejection, absent
 * for a bounce notice that arrived after delivery. `description` is AhaSend's
 * plain-language wording of the server's `response`, preferred when present.
 */
function bounceDetail(attempt: unknown): BounceDetail {
  if (!isRecord(attempt)) return { reason: null, classification: null, statusCode: null }
  return {
    reason: stringOrNull(attempt.description) ?? stringOrNull(attempt.response),
    classification: stringOrNull(attempt.classification),
    statusCode: stringOrNull(attempt.enhanced_status_code),
  }
}

/**
 * The envelope: `{ type, webhook_id, timestamp, data: { message_id_header, …,
 * delivery_attempt? } }`. A report of a type the webhook does not act on, or
 * of one it does without the mail's Message-ID, is returned without a report.
 */
function parseReport(raw: string): { type: string | null; report: DeliveryReport | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { type: null, report: null }
  }
  if (!isRecord(parsed)) return { type: null, report: null }

  const type = stringOrNull(parsed.type)
  const event = type ? EVENT_BY_TYPE[type] : undefined
  if (!type || !event || !isRecord(parsed.data)) return { type, report: null }

  const providerId = stringOrNull(parsed.data.message_id_header)
  if (!providerId) return { type, report: null }

  return {
    type,
    report: {
      event,
      occurredAt: occurredAt(parsed.timestamp),
      providerId,
      bounce: event === 'bounced' ? bounceDetail(parsed.data.delivery_attempt) : null,
    },
  }
}

/** Reads EMAIL_WEBHOOK_SECRET once, when the function starts: the webhook's signing secret, `aha-whsec-…`. */
export function createReportReader(settings: ProviderSettings): ReportReader {
  const secret = settings.required('EMAIL_WEBHOOK_SECRET')
  return {
    async read(headers: Headers, body: string, nowMs: number = Date.now()): Promise<ReadOutcome> {
      const refusal = await verify(secret, headers, body, nowMs)
      if (refusal) return { ok: false, reason: refusal }
      return { ok: true, ...parseReport(body) }
    },
  }
}

// ── Test reports ──────────────────────────────────────────────────────────────

/**
 * The report as AhaSend would post it, signed with `secret` — for the e2e
 * suite, which cannot make AhaSend send one. The fields the webhook does not
 * read are filled with placeholders of the right shape.
 */
export async function encodeReport(report: DeliveryReport, secret: string, nowMs: number = Date.now()): Promise<SignedReport> {
  const deliveryAttempt =
    report.bounce === null
      ? undefined
      : {
          smtp_code: 550,
          ...(report.bounce.statusCode ? { enhanced_status_code: report.bounce.statusCode } : {}),
          ...(report.bounce.reason ? { response: report.bounce.reason } : {}),
          ...(report.bounce.classification ? { classification: report.bounce.classification } : {}),
          command: 'RCPT TO',
        }
  const type = TYPE_BY_EVENT[report.event]
  const body = JSON.stringify({
    type,
    webhook_id: crypto.randomUUID(),
    timestamp: report.occurredAt,
    data: {
      account_id: crypto.randomUUID(),
      event: `on_${report.event}`,
      from: 'shop@e2e.local',
      recipient: 'customer@e2e.local',
      subject: 'E2E report',
      message_id_header: report.providerId,
      id: crypto.randomUUID().replaceAll('-', ''),
      ...(deliveryAttempt ? { delivery_attempt: deliveryAttempt } : {}),
    },
  })
  const id = `msg_${crypto.randomUUID()}`
  const timestamp = String(Math.floor(nowMs / 1000))
  const signature = await sign(secret, `${id}.${timestamp}.${body}`)
  return {
    headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `${SIGNATURE_VERSION},${signature}` },
    body,
  }
}
