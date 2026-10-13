import { requiredEnv } from './database'

/**
 * The runner's handle on the `send-email` edge function: one drain per call,
 * the way the drain cron makes it — `POST /functions/v1/send-email` with
 * `{ "action": "drain" }`. The sender answers once it has processed every
 * message it claimed, so a drain needs no polling after it.
 *
 * Nothing in here reads the result's content; what a drain did is read from
 * the database (`TestDatabase.sentEmails`, `queuedEmails`, `historyCount`).
 */
export class SendEmailFunction {
  private readonly url: string
  private readonly serviceRoleKey: string

  constructor() {
    this.url = `${requiredEnv('VITE_SUPABASE_URL')}/functions/v1/send-email`
    this.serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  }

  /** One drain with the service-role key, as the cron calls it. Throws when the sender does not answer 200. */
  async drain(): Promise<void> {
    const response = await this.call(this.serviceRoleKey)
    if (!response.ok) {
      throw new Error(`send-email drain answered ${response.status}: ${await response.text()}`)
    }
  }

  /** One drain with another bearer token — a user's session, for the caller check. Returns the status the sender answered with. */
  async drainAs(accessToken: string): Promise<number> {
    const response = await this.call(accessToken)
    return response.status
  }

  private call(bearerToken: string): Promise<Response> {
    return fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'drain' }),
    })
  }
}
