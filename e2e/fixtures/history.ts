/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders → **history**.
 * Adds the History page's page object (`historyPage`) and the rows the
 * history views need: a change to the test's customer (`customerChange`), a
 * second customer with an order of its own (`otherCustomerOrder`), more
 * entries on the test's order than one page of the feed holds
 * (`manyOrderEntries`), and a product's entry pushed past that page
 * (`olderProductEntry`). The History page and an order's History tab both
 * read a page at a time.
 *
 * The entries themselves are the database's: creating a customer or an order
 * through the runner's connection writes the same entry the app's write does.
 */
import type { Database } from '../../src/types/supabase'
import { test as base, QUOTE_ORDER, defaultOrderDeadline, reloadApp } from './orders'
import { FULL_CUSTOMER, type TestCustomer } from './customers'
import { HistoryPOM } from '../pom/HistoryPOM'
import type { TestOrder } from '../support/database'

type HistoryEvent = Database['public']['Enums']['history_event']

/** The entry the database writes for each changed field of a customer — one that has no order to be shown on. */
export const CUSTOMER_UPDATED_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_UPDATED'

/** How the page marks an entry's record when it is a customer (`data-record-kind`). */
export const CUSTOMER_RECORD_KIND = 'customer'

/** The phone number `customerChange` gives the customer — another one than FULL_CUSTOMER's. */
export const CHANGED_CUSTOMER_PHONE = '+49 30 7654321'

/** What the entry of that change says: the field, and the value before and after. */
export const CUSTOMER_PHONE_CHANGE_SENTENCE = `changed the customer's phone from “${FULL_CUSTOMER.phone}” to “${CHANGED_CUSTOMER_PHONE}”`

/** A second customer, whose entries and orders are none of the test's customer's. */
export const OTHER_CUSTOMER = {
  name: 'E2E Second Client',
  email: 'second-client@e2e.local',
} as const satisfies TestCustomer

/** The event of the entries `manyOrderEntries` writes; which one is not the point. */
export const BULK_HISTORY_EVENT: HistoryEvent = 'ORDER_ARCHIVED'

/**
 * How many entries `manyOrderEntries` writes in one insert: more than one
 * page of the feed (50), so the page boundary falls among entries that share
 * their time.
 */
export const BULK_HISTORY_ENTRY_COUNT = 55

/** The event of the one entry `olderProductEntry` writes about the product; which one is not the point. */
export const PRODUCT_HISTORY_EVENT: HistoryEvent = 'MARKED_DONE'

/** An event a fresh quote holds no entry of — a filter on it matches nothing. */
export const UNMATCHED_HISTORY_EVENT: HistoryEvent = 'ORDER_FINISHED'

type HistoryViewFixtures = {
  /** The History page (admins): every entry, with its filters. */
  historyPage: HistoryPOM
  /**
   * `customer`'s phone changed to `CHANGED_CUSTOMER_PHONE` through the
   * runner's connection, as another user saving the customer dialog would.
   * Holds the id of the entry the database wrote for it. Use with
   * `customerSeed: FULL_CUSTOMER`, so the phone has a value to change from.
   * The entry is removed with the customer.
   */
  customerChange: { entryId: string }
  /** `OTHER_CUSTOMER` with one quote of its own, inserted before the test and removed after it. */
  otherCustomerOrder: TestOrder
  /** `BULK_HISTORY_ENTRY_COUNT` entries written onto `order` in one insert, so they share their time. Removed with the order. */
  manyOrderEntries: void
  /**
   * One `PRODUCT_HISTORY_EVENT` entry about `product`, then
   * `BULK_HISTORY_ENTRY_COUNT` entries about the order alone written after it,
   * so the product's entry lies past the first page. Holds the product
   * entry's id. Removed with the order.
   */
  olderProductEntry: { entryId: string }
}

export const test = base.extend<HistoryViewFixtures>({
  historyPage: async ({ page }, use) => {
    await use(new HistoryPOM(page))
  },

  customerChange: async ({ page, navbar, database, customer }, use) => {
    await database.updateCustomerPhone(customer.id, CHANGED_CUSTOMER_PHONE)
    const [entryId] = await database.customerHistoryIds(customer.id, CUSTOMER_UPDATED_HISTORY_EVENT)
    await reloadApp(page, navbar)

    await use({ entryId })
  },

  otherCustomerOrder: async ({ page, navbar, database }, use) => {
    const other = await database.createCustomer(OTHER_CUSTOMER)
    const order = await database.createOrder(other.id, {
      status: QUOTE_ORDER.status,
      delivery: QUOTE_ORDER.delivery,
      payment_method: QUOTE_ORDER.paymentMethod,
      deadline: defaultOrderDeadline(),
      billed_at: null,
    })
    await reloadApp(page, navbar)

    await use(order)
    await database.removeCustomer(other.id)
  },

  manyOrderEntries: async ({ page, navbar, database, order }, use) => {
    await database.createHistoryEntries(order.id, BULK_HISTORY_EVENT, BULK_HISTORY_ENTRY_COUNT)
    await reloadApp(page, navbar)

    await use()
  },

  olderProductEntry: async ({ page, navbar, database, order, product }, use) => {
    const entryId = await database.createHistoryEntry(order.id, PRODUCT_HISTORY_EVENT, { productId: product.id })
    await database.createHistoryEntries(order.id, BULK_HISTORY_EVENT, BULK_HISTORY_ENTRY_COUNT)
    await reloadApp(page, navbar)

    await use({ entryId })
  },
})

export { expect } from '@playwright/test'
export * from './orders'
