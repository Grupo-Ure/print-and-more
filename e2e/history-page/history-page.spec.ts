import {
  expect,
  test,
  CUSTOMER_PHONE_CHANGE_SENTENCE,
  CUSTOMER_RECORD_KIND,
  ORDER_CREATED_HISTORY_EVENT,
} from '../fixtures/history'
import { FULL_CUSTOMER } from '../fixtures/customers'
import { TEST_USERS } from '../fixtures/users'

// The History page shows every history entry, whatever it concerns. The
// entries are the database's own: the rows the fixtures insert are recorded by
// the same triggers that record the app's writes, so the tests read which
// entries exist through the runner and look for exactly those on the page.

test.describe('as employee', () => {
  test.use({ user: TEST_USERS.employee })

  test('HIS-FEED-001 an employee has no History link in the navbar', async ({ navbar }) => {
    // Setup — the navbar has rendered its links for the employee the fixture signed in.
    await navbar.link('orders').waitFor()

    // Assert — the page is not offered.
    await expect(navbar.link('history')).toHaveCount(0)
  })
})

test.describe('as admin, a customer changed through the runner', () => {
  test.use({ user: TEST_USERS.admin, customerSeed: FULL_CUSTOMER })

  test('HIS-FEED-002 an admin sees a customer change, which has no order, on the History page', async ({
    historyPage,
    customer,
    customerChange,
  }) => {
    // Setup — the fixture changed the customer's phone; open the page.
    await historyPage.open()

    // Assert — the change is listed, names the customer as its record, and says what changed from what to what.
    const record = historyPage.recordOf(customerChange.entryId)
    await expect(record).toHaveAttribute('data-record-kind', CUSTOMER_RECORD_KIND)
    await expect(record).toHaveText(customer.name)
    await expect(historyPage.item(customerChange.entryId)).toContainText(CUSTOMER_PHONE_CHANGE_SENTENCE)
  })
})

test.describe('as admin, a customer with one order, a second customer with another order', () => {
  test.use({ user: TEST_USERS.admin })

  test('HIS-FEED-003 narrowing to a customer shows its own entries and those of its orders', async ({
    database,
    historyPage,
    customer,
    order,
    otherCustomerOrder: _other,
  }) => {
    // Setup — what the record holds about the customer and about its order; open the page.
    const expected = new Set([
      ...(await database.customerHistoryIds(customer.id)),
      ...(await database.orderHistoryIds(order.id)),
    ])
    await historyPage.open()

    // Act — pick the customer in the record filter.
    await historyPage.recordFilter.click()
    await historyPage.recordSearch.fill(customer.name)
    await historyPage.recordOption(customer.id).click()

    // Assert — exactly those entries: nothing of the second customer or its order.
    await expect.poll(async () => new Set(await historyPage.renderedHistoryIds())).toEqual(expected)
  })
})

test.describe('as admin, an order with several kinds of entries', () => {
  test.use({ user: TEST_USERS.admin })

  test('HIS-FEED-004 narrowing to an event leaves only entries of that event', async ({
    historyPage,
    order,
    manyOrderEntries: _otherEvents,
  }) => {
    // Setup — the page narrowed to the order, which holds its creation and the fixture's entries of another event.
    await historyPage.open()
    await historyPage.narrowToRecord(order.orderNumber, order.id)

    // Act — pick the order's creation in the event filter.
    await historyPage.eventFilter.click()
    await historyPage.eventOption(ORDER_CREATED_HISTORY_EVENT).click()

    // Assert — the one entry of that event is all that is left.
    await expect.poll(() => historyPage.renderedEventTypes()).toEqual([ORDER_CREATED_HISTORY_EVENT])
  })
})

test.describe('as admin, an order with an entry', () => {
  test.use({ user: TEST_USERS.admin })

  test('HIS-FEED-005 the order number on an entry opens the order in the orders view', async ({
    database,
    historyPage,
    ordersPage,
    order,
  }) => {
    // Setup — the entry of the order's creation, on the page.
    const [entryId] = await database.orderHistoryIds(order.id, ORDER_CREATED_HISTORY_EVENT)
    await historyPage.open()

    // Act — click the order number beside the entry.
    await historyPage.recordOf(entryId).click()

    // Assert — the orders view, showing that order.
    await expect(ordersPage.details.forOrder(order.id)).toBeVisible()
  })
})

test.describe('as admin, an order with more than 50 entries, many written in one transaction', () => {
  test.use({ user: TEST_USERS.admin })

  test('HIS-FEED-006 entries past the first page load as the list scrolls, without gaps or repeats', async ({
    database,
    historyPage,
    order,
    manyOrderEntries: _many,
  }) => {
    // Setup — every entry the order has, and the page narrowed to the order.
    const expected = (await database.orderHistoryIds(order.id)).sort()
    await historyPage.open()
    await historyPage.narrowToRecord(order.orderNumber, order.id)

    // Act — scroll to the end of what the first page loaded.
    await historyPage.items.last().scrollIntoViewIfNeeded()

    // Assert — each of the order's entries is listed, once.
    await expect.poll(async () => (await historyPage.renderedHistoryIds()).sort()).toEqual(expected)
  })
})
