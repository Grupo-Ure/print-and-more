import { createAdminClient } from './support/admin'
import { TestData } from './support/testData'
import { TEST_USERS } from './fixtures/users'

/** Runs once after the suite: leaves no test logins behind. */
export default async function globalTeardown(): Promise<void> {
  const testData = new TestData(createAdminClient())
  for (const user of Object.values(TEST_USERS)) {
    await testData.removeUser(user)
  }
}
