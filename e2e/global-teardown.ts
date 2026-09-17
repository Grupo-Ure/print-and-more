import { TestDatabase } from './support/database'
import { TEST_USERS } from './fixtures/users'

/** Runs once after the suite: leaves no test logins behind. */
export default async function globalTeardown(): Promise<void> {
  const database = new TestDatabase()
  for (const user of Object.values(TEST_USERS)) {
    await database.removeUser(user)
  }
}
