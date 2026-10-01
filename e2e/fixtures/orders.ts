/**
 * Fixture chain: `@playwright/test` → database → electron → auth → **orders**.
 * Adds the orders view's page object (`ordersPage`) and the per-test data of
 * that view (`customer`, `order`, `product`, `newCustomer`,
 * `departmentDefault`, `developer`).
 *
 * Fixtures only seed data and reload so the app can see it. They never
 * navigate: getting to the order or product under test is the test's own Setup
 * stage. The one exception is the auth state, handled in fixtures/auth.ts.
 */
import type { Page } from '@playwright/test'
import { addDays, format } from 'date-fns'
import type { DefaultAssigneeStatus, DeliveryChoice, Department, OrderStatus, PaymentMethod } from '../../src/types/database'
import { test as base } from './auth'
import { NEW_CUSTOMER, TEST_CUSTOMER, type TestCustomer } from './customers'
import { OTHER_PRODUCT } from './products'
import { EMPTY_PREPRESS_DEFAULT, type DepartmentDefaultSeed } from './departments'
import { APPROVAL_FILE } from './files'
import { IN_STOCK_STAMP_MODEL, OUT_OF_STOCK_STAMP_MODEL } from './stamps'
import { IN_STOCK_TEXTILE_CHAIN } from './textiles'
import { ADMIN_AS_DEVELOPER, type TestUser } from './users'
import type { ProductSeed, TestCustomerRow, TestFile, TestOrder, TestProduct } from '../support/database'
import { NavbarPOM } from '../pom/NavbarPOM'
import { OrdersPOM } from '../pom/OrdersPOM'

/** The status every order starts in, however it was created. */
export const NEW_ORDER_STATUS: OrderStatus = 'QUOTE'

/** The status "Start processing" moves an order to. */
export const IN_PROGRESS_STATUS: OrderStatus = 'IN_PROGRESS'

/** The status an invoice order reaches once its last product is done — on its own, or by "Mark finished". */
export const FINISHED_STATUS: OrderStatus = 'FINISHED'

/** The terminal status "Mark as invoiced" (invoice) or "Finish & close" (cash) moves an order to. */
export const BILLED_STATUS: OrderStatus = 'BILLED'

/**
 * A deadline the picker accepts that differs from the default a new order gets
 * (today), so a test can see that a pick changed it. Produced at call time,
 * never stored.
 */
export function nextOrderDeadline(): string {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd')
}

/** A deadline that has already passed (yesterday), produced at call time like the one above. */
export function missedOrderDeadline(): string {
  return format(addDays(new Date(), -1), 'yyyy-MM-dd')
}

/**
 * What the `order` fixture inserts. The deadline is named relative to today
 * rather than as a date because a valid one has to be produced at call time.
 *
 * A seed must describe a state the app can reach, since nothing in the
 * database enforces the lifecycle:
 * - `QUOTE` and `IN_PROGRESS` have no requirements of their own.
 * - `FINISHED` is only offered once every product is done, so a product seeded
 *   into such an order must be `PRODUCT_DONE`.
 * - `BILLED` is never seeded: the app archives the order at that moment and
 *   a billed order is never listed, so there is nothing left to drive.
 */
export type OrderSeed = {
  status: OrderStatus
  delivery: DeliveryChoice | null
  paymentMethod: PaymentMethod
  deadline: 'tomorrow' | 'yesterday' | null
}

/** A fresh quote with nothing set — the default. */
export const QUOTE_ORDER: OrderSeed = { status: NEW_ORDER_STATUS, delivery: null, paymentMethod: 'INVOICE', deadline: null }

/** A quote with deadline and delivery set: a product in it is complete the moment processing starts. */
export const COMPLETE_QUOTE_ORDER: OrderSeed = { ...QUOTE_ORDER, delivery: 'PICKUP', deadline: 'tomorrow' }

/** An accepted order with deadline and delivery set: a product in it inherits the deadline and is complete at once. */
export const IN_PROGRESS_ORDER: OrderSeed = { ...QUOTE_ORDER, status: IN_PROGRESS_STATUS, delivery: 'PICKUP', deadline: 'tomorrow' }

/** An accepted order still missing its deadline: a product in it is held in setup until one is set. */
export const IN_PROGRESS_ORDER_WITHOUT_DEADLINE: OrderSeed = { ...IN_PROGRESS_ORDER, deadline: null }

/** An accepted order whose deadline has passed: a past deadline does not block a product in it from entering pre-press. */
export const IN_PROGRESS_ORDER_PAST_DEADLINE: OrderSeed = { ...IN_PROGRESS_ORDER, deadline: 'yesterday' }

const DEADLINE_BY_NAME: Record<NonNullable<OrderSeed['deadline']>, () => string> = {
  tomorrow: nextOrderDeadline,
  yesterday: missedOrderDeadline,
}

/** An accepted order paid in cash: it skips FINISHED and closes in one step. */
export const IN_PROGRESS_CASH_ORDER: OrderSeed = { ...IN_PROGRESS_ORDER, paymentMethod: 'CASH' }

/** A finished invoice order, awaiting "Mark as invoiced". Seed only `PRODUCT_DONE` products into it. */
export const FINISHED_ORDER: OrderSeed = { ...IN_PROGRESS_ORDER, status: FINISHED_STATUS }

/** The slot the `departmentDefault` fixture owns, and who it holds (`null` while empty). */
export type TestDepartmentDefault = {
  department: Department
  status: DefaultAssigneeStatus
  userId: string | null
}

type OrdersViewFixtures = {
  /**
   * The catalog rows the product seeds reference (two stamp models, one
   * textile brand → model → variant). Automatic: before every test the
   * rows are inserted, or reset to their seed if already there — so stock a
   * previous test deducted is back to its seed value — and after the test
   * they are removed with the movements booked against them.
   */
  catalog: void
  /** The orders view — the app's main screen, with every dialog it can open. */
  ordersPage: OrdersPOM
  /** What `customer` inserts; override per describe block with `test.use({ customerSeed })`. */
  customerSeed: TestCustomer
  /** What `order` inserts; override per describe block with `test.use({ orderSeed })`. */
  orderSeed: OrderSeed
  /** What `product` inserts; override per describe block with `test.use({ productSeed })`. */
  productSeed: ProductSeed
  /**
   * What `products` inserts, one product per entry. Override per describe block
   * as `test.use({ productSeeds: [SEEDS, { scope: 'test' }] })`: Playwright
   * reads any array whose second element is an object as a `[value, options]`
   * tuple, so a bare array of seeds would be taken apart.
   */
  productSeeds: readonly ProductSeed[]
  /**
   * A customer that exists only for this test: inserted before it through
   * the runner's database connection, deleted after it — together with any
   * order the test created for it — even when the test fails.
   */
  customer: TestCustomerRow
  /** A fresh order for `customer` in the state `orderSeed` describes, created before the test and deleted after it. */
  order: TestOrder
  /** A fresh product in `order` as `productSeed` describes it, with its spec. Removed with the order. */
  product: TestProduct
  /**
   * Several fresh products in `order`, one per `productSeeds` entry in that
   * order — for what the app does to every product of an order at once.
   * Independent of `product`. Removed with the order.
   */
  products: TestProduct[]
  /** A file linked to `order`, for the customer approval. Removed with the order. */
  orderFile: TestFile
  /**
   * The data for a customer the test creates itself, through the app.
   * Whatever was saved under that email — the customer and its orders — is
   * removed afterwards, and beforehand in case an aborted run left it behind.
   */
  newCustomer: TestCustomer
  /** What `departmentDefault` seeds; override per describe block with `test.use({ departmentDefaultSeed })`. */
  departmentDefaultSeed: DepartmentDefaultSeed
  /**
   * One department's default assignee for one stage, as `departmentDefaultSeed`
   * describes it: filled before the test when the seed names a user, and
   * emptied after it either way — so a default a test picked in the app does
   * not leak into the next one.
   */
  departmentDefault: TestDepartmentDefault
  /** Which login `developer` flags; override per describe block with `test.use({ developerSeed })`. */
  developerSeed: TestUser
  /** The id of the login `developerSeed` names, flagged as a developer account before the test and unflagged after it. */
  developer: string
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
  catalog: [
    async ({ database }, use) => {
      await database.upsertStampModel(OUT_OF_STOCK_STAMP_MODEL)
      await database.upsertStampModel(IN_STOCK_STAMP_MODEL)
      await database.upsertTextileChain(IN_STOCK_TEXTILE_CHAIN)

      await use()

      await database.removeTextileChain(IN_STOCK_TEXTILE_CHAIN)
      await database.removeStampModel(IN_STOCK_STAMP_MODEL.id)
      await database.removeStampModel(OUT_OF_STOCK_STAMP_MODEL.id)
    },
    // `auto`: runs for every test without being named, so a product seed
    // always finds its catalog row, at its seed stock.
    { auto: true },
  ],

  ordersPage: async ({ page }, use) => {
    await use(new OrdersPOM(page))
  },

  customerSeed: [TEST_CUSTOMER, { option: true }],
  orderSeed: [QUOTE_ORDER, { option: true }],
  productSeed: [OTHER_PRODUCT, { option: true }],
  productSeeds: [[], { option: true }],
  departmentDefaultSeed: [EMPTY_PREPRESS_DEFAULT, { option: true }],
  developerSeed: [ADMIN_AS_DEVELOPER, { option: true }],

  customer: async ({ page, navbar, database, customerSeed }, use) => {
    const customer = await database.createCustomer(customerSeed)
    await reloadApp(page, navbar)

    await use(customer)
    await database.removeCustomer(customer.id)
  },

  order: async ({ page, navbar, database, customer, orderSeed }, use) => {
    const order = await database.createOrder(customer.id, {
      status: orderSeed.status,
      delivery: orderSeed.delivery,
      payment_method: orderSeed.paymentMethod,
      deadline: orderSeed.deadline ? DEADLINE_BY_NAME[orderSeed.deadline]() : null,
    })
    await reloadApp(page, navbar)

    await use(order)
    await database.removeOrder(order.id)
  },

  product: async ({ page, navbar, database, order, productSeed }, use) => {
    const created = await database.createProduct(order.id, productSeed)
    await reloadApp(page, navbar)

    await use(created)
  },

  products: async ({ page, navbar, database, order, productSeeds }, use) => {
    const created: TestProduct[] = []
    for (const seed of productSeeds) {
      created.push(await database.createProduct(order.id, seed))
    }
    await reloadApp(page, navbar)

    await use(created)
  },

  orderFile: async ({ page, navbar, database, order }, use) => {
    const file = await database.createFile(order.id, APPROVAL_FILE)
    await reloadApp(page, navbar)

    await use(file)
  },

  newCustomer: async ({ database }, use) => {
    await database.removeCustomersByEmail(NEW_CUSTOMER.email)

    await use(NEW_CUSTOMER)
    await database.removeCustomersByEmail(NEW_CUSTOMER.email)
  },

  departmentDefault: async ({ page, navbar, database, departmentDefaultSeed }, use) => {
    const { department, status, user } = departmentDefaultSeed
    const userId = user ? await database.setDepartmentDefault(department, status, user) : null
    // Reload even for an empty slot: the previous test may have left the
    // settings page's list of defaults in the app's cache.
    await reloadApp(page, navbar)

    await use({ department, status, userId })
    await database.removeDepartmentDefault(department, status)
  },

  developer: async ({ page, navbar, database, developerSeed }, use) => {
    const userId = await database.setDeveloper(developerSeed, true)
    // The app caches the user list; reload so the pickers see the flag.
    await reloadApp(page, navbar)

    await use(userId)
    await database.setDeveloper(developerSeed, false)
  },
})

export { expect } from '@playwright/test'
