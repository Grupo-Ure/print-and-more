import { TestDatabase } from './support/database'
import { TEST_USERS } from './fixtures/users'

/** Runs once before the suite: the logins every spec signs in with. */
export default async function globalSetup(): Promise<void> {
  const database = new TestDatabase()
  for (const user of Object.values(TEST_USERS)) {
    await database.ensureUser(user)
  }
}
