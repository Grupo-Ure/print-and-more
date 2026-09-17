/**
 * Fixture chain: `@playwright/test` → database → electron → auth → **orders**.
 * Adds the orders view's page object (`ordersPage`) and the per-test data of
 * that view (`customer`, `order`, `job`, `newCustomer`).
 *
 * Fixtures only seed data and reload so the app can see it. They never
 * navigate: getting to the order or job under test is part of the test's own
 * Act stage. The one exception is the auth state, handled in fixtures/auth.ts.
 */
import type { Page } from '@playwright/test'
import { addDays, format } from 'date-fns'
import type { OrderStatus } from '../../src/types/database'
import { test as base } from './auth'
import { NEW_CUSTOMER, TEST_CUSTOMER, type TestCustomer } from './customers'
import { TEST_JOB_DEPARTMENT } from './jobs'
import type { TestCustomerRow, TestJob, TestOrder } from '../support/database'
import { NavbarPOM } from '../pom/NavbarPOM'
import { OrdersPOM } from '../pom/OrdersPOM'

/** The status every order starts in, however it was created. */
export const NEW_ORDER_STATUS: OrderStatus = 'QUOTE'

/**
 * A deadline the picker accepts: the earliest selectable day is tomorrow, so
 * this is produced at call time, never stored.
 */
export function nextOrderDeadline(): string {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

type OrdersViewFixtures = {
  /** The orders view — the app's main screen, with every dialog it can open. */
  ordersPage: OrdersPOM
  /**
   * A customer that exists only for this test: inserted before it through
   * the runner's database connection, deleted after it — together with any
   * order the test created for it — even when the test fails.
   */
  customer: TestCustomerRow
  /** A fresh quote for `customer`, created before the test and deleted after it. */
  order: TestOrder
  /**
   * A fresh job of `TEST_JOB_DEPARTMENT` in `order`, inserted in its initial
   * state. Removed with the order.
   */
  job: TestJob
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
async function reloadApp(page: Page, navbar: NavbarPOM): Promise<void> {
  await page.reload()
  await navbar.userMenu.trigger.waitFor()
}

export const test = base.extend<OrdersViewFixtures>({
  ordersPage: async ({ page }, use) => {
    await use(new OrdersPOM(page))
  },

  customer: async ({ page, navbar, database }, use) => {
    const customer = await database.createCustomer(TEST_CUSTOMER)
    await reloadApp(page, navbar)

    await use(customer)
    await database.removeCustomer(customer.id)
  },

  order: async ({ page, navbar, database, customer }, use) => {
    const order = await database.createOrder(customer.id)
    await reloadApp(page, navbar)

    await use(order)
    await database.removeOrder(order.id)
  },

  job: async ({ page, navbar, database, order }, use) => {
    const job = await database.createJob(order.id, TEST_JOB_DEPARTMENT)
    await reloadApp(page, navbar)

    await use(job)
  },

  newCustomer: async ({ database }, use) => {
    await database.removeCustomersByEmail(NEW_CUSTOMER.email)

    await use(NEW_CUSTOMER)
    await database.removeCustomersByEmail(NEW_CUSTOMER.email)
  },
})

export { expect } from '@playwright/test'
