import { createHmac, randomUUID } from 'node:crypto'
import type { DeliveryReport } from '../fixtures/emailMessages'
import { requiredEnv } from './database'

/** The prefix Resend puts before the base64 key of an endpoint's signing secret. */
const SECRET_PREFIX = 'whsec_'

/**
 * Signs a report the way Svix, and so Resend, does: an HMAC-SHA256 over
 * `<id>.<timestamp>.<body>` with the key behind the secret's `whsec_` prefix,
 * presented in the three `svix-*` headers the function verifies.
 */
function signatureHeaders(secret: string, body: string): Record<string, string> {
  const id = `msg_${randomUUID()}`
  const timestamp = String(Math.floor(Date.now() / 1000))
  const encoded = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret
  const signature = createHmac('sha256', Buffer.from(encoded, 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64')
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` }
}

/**
 * The runner's handle on the `email-webhook` edge function: one delivery
 * report per call, posted the way Resend posts it — signed, with no Supabase
 * session. The secret is the one the local function verifies against,
 * `RESEND_WEBHOOK_SECRET` from `supabase/functions/.env`, which the Playwright
 * config loads into the runner.
 *
 * Nothing in here reads the result's content; what a report did is read from
 * the database (`TestDatabase.sentEmailDelivery`, `customerEmailBouncedAt`,
 * `historyCount`).
 */
export class EmailWebhookFunction {
  private readonly url: string
  private readonly secret: string

  constructor() {
    this.url = `${requiredEnv('VITE_SUPABASE_URL')}/functions/v1/email-webhook`
    this.secret = requiredEnv('RESEND_WEBHOOK_SECRET')
  }

  /** Posts one report signed with the function's secret, as Resend would. Throws when the function does not answer 200. */
  async report(report: DeliveryReport): Promise<void> {
    const response = await this.post(this.secret, report)
    if (!response.ok) {
      throw new Error(`email-webhook answered ${response.status}: ${await response.text()}`)
    }
  }

  /** Posts one report signed with another secret — a forged report, for the signature check. Returns the status the function answered with. */
  async reportSignedWith(secret: string, report: DeliveryReport): Promise<number> {
    const response = await this.post(secret, report)
    return response.status
  }

  private post(secret: string, report: DeliveryReport): Promise<Response> {
    const body = JSON.stringify(report)
    return fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signatureHeaders(secret, body) },
      body,
    })
  }
}
