import { test as base } from './auth'
import { TEST_CUSTOMER } from './customers'
import { createAdminClient } from '../support/admin'
import { createTestOrder, removeTestOrder, type TestOrder } from '../support/orders'
import { NavbarPOM } from '../pom/NavbarPOM'

type OrderFixtures = {
  /**
   * A fresh quote (with its own customer) that exists only for this test:
   * created before the test through the service-role client, deleted after
   * it, even when the test fails.
   */
  order: TestOrder
}

// No `expect` in here: fixtures synchronise with `waitFor()`. A timeout then
// reads as a setup failure, not as a test assertion.

export const test = base.extend<OrderFixtures>({
  order: async ({ page }, use) => {
    const admin = createAdminClient()
    const order = await createTestOrder(admin, TEST_CUSTOMER)

    // The app only refetches its order list on its own writes, so a row
    // inserted behind its back needs a reload to show up. The session lives
    // in web storage and survives it; wait until the navbar is back.
    await page.reload()
    await new NavbarPOM(page).userMenu.trigger.waitFor()

    await use(order)
    await removeTestOrder(admin, order)
  },
})

export { expect } from '@playwright/test'
