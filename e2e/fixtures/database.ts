/**
 * Base of the fixture chain: `@playwright/test` → database → electron → auth → orders.
 * Adds `database`, the runner's connection every layer above seeds its rows through.
 */
import { test as base } from '@playwright/test'
import { TestDatabase } from '../support/database'

type WorkerFixtures = {
  /**
   * The runner's service-role connection to the database. Worker-scoped:
   * opened on first use, then shared by every test the worker runs.
   */
  database: TestDatabase
}

export const test = base.extend<object, WorkerFixtures>({
  database: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
    async ({}, use) => {
      await use(new TestDatabase())
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
