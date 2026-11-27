import { TestDatabase } from './support/database'
import { RealtimeService } from './support/realtime'
import { TEST_USERS } from './fixtures/users'

/**
 * Runs once before the suite: the realtime limit the suite's reloads need, and
 * the logins every spec signs in with.
 */
export default async function globalSetup(): Promise<void> {
  await new RealtimeService().raiseChangeEventLimit()

  const database = new TestDatabase()
  for (const user of Object.values(TEST_USERS)) {
    await database.ensureUser(user)
  }
}
