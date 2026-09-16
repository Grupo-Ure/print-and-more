import { createAdminClient } from './support/admin'
import { removeTestUser } from './support/users'
import { TEST_USERS } from './fixtures/users'

/** Runs once after the suite: leaves no test logins behind. */
export default async function globalTeardown(): Promise<void> {
  const admin = createAdminClient()
  for (const user of Object.values(TEST_USERS)) {
    await removeTestUser(admin, user)
  }
}
