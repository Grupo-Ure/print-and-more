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
import type { DeliveryChoice, OrderStatus, PaymentMethod } from '../../src/types/database'
import { test as base } from './auth'
import { NEW_CUSTOMER, TEST_CUSTOMER, type TestCustomer } from './customers'
import { EMPTY_JOB, type JobSeed } from './jobs'
import type { TestCustomerRow, TestJob, TestOrder } from '../support/database'
import { NavbarPOM } from '../pom/NavbarPOM'
import { OrdersPOM } from '../pom/OrdersPOM'

/** The status every order starts in, however it was created. */
export const NEW_ORDER_STATUS: OrderStatus = 'QUOTE'

/** The status "Start processing" moves an order to. */
export const IN_PROGRESS_STATUS: OrderStatus = 'IN_PROGRESS'

/** The status "Mark finished" moves an invoice order to. */
export const FINISHED_STATUS: OrderStatus = 'FINISHED'

/**
 * A deadline the picker accepts: the earliest selectable day is tomorrow, so
 * this is produced at call time, never stored.
 */
export function nextOrderDeadline(): string {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

/**
 * What the `order` fixture inserts. The deadline is a flag rather than a
 * date because a valid one has to be produced at call time.
 *
 * A seed must describe a state the app can reach, since nothing in the
 * database enforces the lifecycle:
 * - `QUOTE` and `IN_PROGRESS` have no requirements of their own.
 * - `FINISHED` is only offered once every job is done, so a job seeded into
 *   such an order must be `JOB_DONE`.
 * - `BILLED` is never seeded: the app archives the order at that moment and
 *   a billed order is never listed, so there is nothing left to drive.
 */
export type OrderSeed = {
  status: OrderStatus
  delivery: DeliveryChoice | null
  paymentMethod: PaymentMethod
  withDeadline: boolean
}

/** A fresh quote with nothing set — the default. */
export const QUOTE_ORDER: OrderSeed = { status: NEW_ORDER_STATUS, delivery: null, paymentMethod: 'INVOICE', withDeadline: false }

/** An accepted order with deadline and delivery set: a job in it is complete as soon as it has a product. */
export const IN_PROGRESS_ORDER: OrderSeed = { ...QUOTE_ORDER, status: IN_PROGRESS_STATUS, delivery: 'PICKUP', withDeadline: true }

/** An accepted order still missing its deadline: a job in it is held in setup until one is set. */
export const IN_PROGRESS_ORDER_WITHOUT_DEADLINE: OrderSeed = { ...IN_PROGRESS_ORDER, withDeadline: false }

/** An accepted order paid in cash: it skips FINISHED and closes in one step. */
export const IN_PROGRESS_CASH_ORDER: OrderSeed = { ...IN_PROGRESS_ORDER, paymentMethod: 'CASH' }

/** A finished invoice order, awaiting "Mark as invoiced". Seed only `JOB_DONE` jobs into it. */
export const FINISHED_ORDER: OrderSeed = { ...IN_PROGRESS_ORDER, status: FINISHED_STATUS }

type OrdersViewFixtures = {
  /** The orders view — the app's main screen, with every dialog it can open. */
  ordersPage: OrdersPOM
  /** What `order` inserts; override per describe block with `test.use({ orderSeed })`. */
  orderSeed: OrderSeed
  /** What `job` inserts; override per describe block with `test.use({ jobSeed })`. */
  jobSeed: JobSeed
  /**
   * A customer that exists only for this test: inserted before it through
   * the runner's database connection, deleted after it — together with any
   * order the test created for it — even when the test fails.
   */
  customer: TestCustomerRow
  /** A fresh order for `customer` in the state `orderSeed` describes, created before the test and deleted after it. */
  order: TestOrder
  /** A fresh job in `order` as `jobSeed` describes it, in its initial status. Removed with the order. */
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

  orderSeed: [QUOTE_ORDER, { option: true }],
  jobSeed: [EMPTY_JOB, { option: true }],

  customer: async ({ page, navbar, database }, use) => {
    const customer = await database.createCustomer(TEST_CUSTOMER)
    await reloadApp(page, navbar)

    await use(customer)
    await database.removeCustomer(customer.id)
  },

  order: async ({ page, navbar, database, customer, orderSeed }, use) => {
    const order = await database.createOrder(customer.id, {
      status: orderSeed.status,
      delivery: orderSeed.delivery,
      payment_method: orderSeed.paymentMethod,
      deadline: orderSeed.withDeadline ? nextOrderDeadline() : null,
    })
    await reloadApp(page, navbar)

    await use(order)
    await database.removeOrder(order.id)
  },

  job: async ({ page, navbar, database, order, jobSeed }, use) => {
    const job = await database.createJob(order.id, { department: jobSeed.department, status: jobSeed.status })
    if (jobSeed.product) await database.createProduct(job, jobSeed.product)
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
