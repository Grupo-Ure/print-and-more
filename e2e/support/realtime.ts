import { requiredEnv } from './database'

/** The tenant the local stack's realtime service runs as; the Supabase CLI names it. */
const LOCAL_TENANT = 'realtime-dev'

/**
 * Change events per second the suite allows itself. The local default is 100,
 * counted once per subscription a change is delivered to.
 */
const SUITE_CHANGE_EVENT_LIMIT = 10_000

/**
 * The runner's handle on the local realtime service's management API
 * (`/realtime/v1/api`, through the gateway, with the service-role key).
 *
 * The suite reloads the app before almost every test, and the subscriptions
 * of a page that went away stay registered for a few seconds. Every change
 * the database publishes counts once per registered subscription, so the
 * runs of reloads push the count past the service's limit — and while the
 * limit is passed the service discards changes instead of delivering them.
 * The app then never hears of a change it is waiting for, and the test that
 * waits on the live refresh times out. No shop reloads at that rate; the
 * limit is raised for the suite, not for the app.
 *
 * The service puts its default back when its container restarts, so the limit
 * is raised at the start of every run.
 */
export class RealtimeService {
  private readonly url: string
  private readonly serviceRoleKey: string

  constructor() {
    this.url = `${requiredEnv('VITE_SUPABASE_URL')}/realtime/v1/api/tenants/${LOCAL_TENANT}`
    this.serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  }

  /** Raises the limit on change events per second. Throws when the service does not answer 200. */
  async raiseChangeEventLimit(): Promise<void> {
    const response = await fetch(this.url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant: { max_events_per_second: SUITE_CHANGE_EVENT_LIMIT } }),
    })
    if (!response.ok) {
      throw new Error(`realtime answered ${response.status} to the change event limit: ${await response.text()}`)
    }
  }
}
