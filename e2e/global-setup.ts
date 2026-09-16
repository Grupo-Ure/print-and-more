import { createAdminClient } from './support/admin'
import { ensureTestUser } from './support/users'
import { TEST_USERS } from './fixtures/users'

/** Runs once before the suite: the logins every spec signs in with. */
export default async function globalSetup(): Promise<void> {
  const admin = createAdminClient()
  for (const user of Object.values(TEST_USERS)) {
    await ensureTestUser(admin, user)
  }
}
