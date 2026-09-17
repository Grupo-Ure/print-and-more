import { createAdminClient } from './support/admin'
import { TestData } from './support/testData'
import { TEST_USERS } from './fixtures/users'

/** Runs once before the suite: the logins every spec signs in with. */
export default async function globalSetup(): Promise<void> {
  const testData = new TestData(createAdminClient())
  for (const user of Object.values(TEST_USERS)) {
    await testData.ensureUser(user)
  }
}
