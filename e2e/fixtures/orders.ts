import type { Page } from '@playwright/test'
import type { OrderStatus } from '../../src/types/database'
import { test as base } from './auth'
import { NEW_CUSTOMER, TEST_CUSTOMER, type TestCustomer } from './customers'
import { createAdminClient } from '../support/admin'
import {
  createTestCustomer,
  removeTestCustomer,
  removeTestCustomersByEmail,
  type TestCustomerRow,
} from '../support/customers'
import { createTestOrder, removeTestOrder, type TestOrder } from '../support/orders'
import { NavbarPOM } from '../pom/NavbarPOM'

/** The status every order starts in, however it was created. */
export const NEW_ORDER_STATUS: OrderStatus = 'QUOTE'

type OrdersViewFixtures = {
  /**
   * A customer that exists only for this test: inserted before it through
   * the service-role client, deleted after it — together with any order the
   * test created for it — even when the test fails.
   */
  customer: TestCustomerRow
  /** A fresh quote for `customer`, created before the test and deleted after it. */
  order: TestOrder
  /**
   * The data for a customer the test creates itself, through the app.
   * Whatever was saved under that email — the customer and its orders — is
   * removed afterwards, and beforehand in case an aborted run left it behind.
   */
  newCustomer: TestCustomer
}

// No `expect` in here: fixtures synchronise with `waitFor()`. A timeout then
// reads as a setup failure, not as a test assertion.

/**
 * The app only refetches on its own writes, so a row inserted behind its back
 * needs a reload to show up (in the order list, in the customer search). The
 * session lives in web storage and survives it; wait until the navbar is back.
 */
async function reloadApp(page: Page): Promise<void> {
  await page.reload()
  await new NavbarPOM(page).userMenu.trigger.waitFor()
}

export const test = base.extend<OrdersViewFixtures>({
  customer: async ({ page }, use) => {
    const admin = createAdminClient()
    const customer = await createTestCustomer(admin, TEST_CUSTOMER)
    await reloadApp(page)

    await use(customer)
    await removeTestCustomer(admin, customer.id)
  },

  order: async ({ page, customer }, use) => {
    const admin = createAdminClient()
    const order = await createTestOrder(admin, customer.id)
    await reloadApp(page)

    await use(order)
    await removeTestOrder(admin, order.id)
  },

  // eslint-disable-next-line no-empty-pattern
  newCustomer: async ({}, use) => {
    const admin = createAdminClient()
    await removeTestCustomersByEmail(admin, NEW_CUSTOMER.email)

    await use(NEW_CUSTOMER)
    await removeTestCustomersByEmail(admin, NEW_CUSTOMER.email)
  },
})

export { expect } from '@playwright/test'
