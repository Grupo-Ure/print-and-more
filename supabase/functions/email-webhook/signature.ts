// Resend signs every delivery report the way Svix does: three headers
// (svix-id, svix-timestamp, svix-signature) and an HMAC-SHA256 over
// `<id>.<timestamp>.<raw body>` with the key behind the `whsec_` prefix of the
// endpoint's secret. The signature header may carry several space-separated
// `v1,<base64>` entries (a rotated secret adds one); any one matching is
// enough. A report older or newer than the tolerance is refused, so a
// captured one cannot be replayed later.
//
// Verified by hand rather than through a library: it is one HMAC, and the
// e2e suite signs its test reports the same way.

import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

/** How far a report's timestamp may lie from now, in seconds (Svix's own default). */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

const SECRET_PREFIX = 'whsec_'

const SIGNATURE_VERSION = 'v1'

export type SignatureVerdict = { ok: true } | { ok: false; reason: string }

/** The three headers a signed report carries, or null when one is missing. */
function signatureHeaders(headers: Headers): { id: string; timestamp: string; signature: string } | null {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')
  if (!id || !timestamp || !signature) return null
  return { id, timestamp, signature }
}

/** The raw HMAC key: the base64 behind the `whsec_` prefix. A secret without the prefix is taken as is. */
function keyBytes(secret: string): Uint8Array<ArrayBuffer> {
  const encoded = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret
  // Copied into a buffer of its own: Web Crypto takes a plain ArrayBuffer view, not Node's pooled one.
  return new Uint8Array(Buffer.from(encoded, 'base64'))
}

async function sign(secret: string, content: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content))
  return Buffer.from(mac).toString('base64')
}

function matches(expected: string, presented: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Whether the report really came from the endpoint's owner and recently. The
 * body must be the raw request text, byte for byte as received — a re-serialised
 * JSON would not sign the same.
 */
export async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  body: string,
  nowMs: number = Date.now(),
): Promise<SignatureVerdict> {
  const presented = signatureHeaders(headers)
  if (!presented) return { ok: false, reason: 'missing_signature_headers' }

  const timestamp = Number(presented.timestamp)
  if (!Number.isInteger(timestamp)) return { ok: false, reason: 'malformed_timestamp' }
  if (Math.abs(nowMs / 1000 - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp_out_of_tolerance' }

  const expected = await sign(secret, `${presented.id}.${presented.timestamp}.${body}`)
  const candidates = presented.signature
    .split(' ')
    .map(entry => entry.split(',', 2))
    .filter(([version]) => version === SIGNATURE_VERSION)
    .map(([, value]) => value ?? '')

  return candidates.some(candidate => matches(expected, candidate)) ? { ok: true } : { ok: false, reason: 'signature_mismatch' }
}
