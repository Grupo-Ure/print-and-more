import type { DeliveryReport } from '../../supabase/functions/_shared/emailProvider.ts'
import { encodeReport } from '../../supabase/functions/_shared/emailProviders/active.ts'
import { requiredEnv } from './database'

/**
 * The runner's handle on the `email-webhook` edge function: one delivery
 * report per call, posted the way the email provider posts it — in its
 * format, signed, with no Supabase session. The format and the signing are
 * the provider's own (`encodeReport` from the provider in use), so nothing
 * here or in the specs changes with the provider. The secret is the one the
 * local function verifies against, `EMAIL_WEBHOOK_SECRET` from
 * `supabase/functions/.env`, which the Playwright config loads into the
 * runner.
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
    this.secret = requiredEnv('EMAIL_WEBHOOK_SECRET')
  }

  /** Posts one report signed with the function's secret, as the provider would. Throws when the function does not answer 200. */
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

  private async post(secret: string, report: DeliveryReport): Promise<Response> {
    const { headers, body } = await encodeReport(report, secret)
    return fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    })
  }
}
