/**
 * Base of the fixture chain: `@playwright/test` → testData → electron → auth → orders.
 * Adds `testData`, the seeding client every layer above uses for its rows.
 */
import { test as base } from '@playwright/test'
import { createAdminClient } from '../support/admin'
import { TestData } from '../support/testData'

type WorkerFixtures = {
  /**
   * Seeds and removes rows through the service-role client. Worker-scoped:
   * built on first use, then shared by every test the worker runs.
   */
  testData: TestData
}

export const test = base.extend<object, WorkerFixtures>({
  testData: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
    async ({}, use) => {
      await use(new TestData(createAdminClient()))
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
