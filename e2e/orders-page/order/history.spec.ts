import { expect, test, ORDER_CREATED_HISTORY_EVENT, UNMATCHED_HISTORY_EVENT } from '../../fixtures/history'

// An order's History tab reads the order's whole record a page at a time, as
// the History page does, and its filters search every entry in the database,
// not only the page loaded. The entries are the database's: creating the order
// through the runner writes its ORDER_CREATED entry, the oldest it has.

test('ORD-HIS-001 scrolling the History tab of an order with more entries than one page shows the older ones', async ({
  ordersPage,
  order,
  manyOrderEntries: _many,
}) => {
  // Setup — the order's History tab, its first page loaded; the order's creation lies past it.
  const { history } = ordersPage.details
  await ordersPage.openOrderHistory(order.id)

  // Act — scroll to the end of what the first page loaded.
  await history.items.last().scrollIntoViewIfNeeded()

  // Assert — the next page came in: the order's creation, its oldest entry, is listed.
  await expect(history.ofType(ORDER_CREATED_HISTORY_EVENT)).toBeVisible()
})

test("ORD-HIS-002 filtering the History tab by a product finds that product's entry older than the newest page", async ({
  ordersPage,
  product,
  olderProductEntry,
}) => {
  // Setup — the order's History tab, its first page loaded; the product's one entry lies past it.
  const { history } = ordersPage.details
  await ordersPage.openOrderHistory(product.orderId)

  // Act — pick the product in the product filter.
  await history.productFilter.click()
  await history.productOption(product.id).click()

  // Assert — the database's answer holds the product's entry.
  await expect(history.item(olderProductEntry.entryId)).toBeVisible()
})

test("ORD-HIS-003 clearing a History tab filter that matches nothing brings the order's entries back", async ({
  ordersPage,
  order,
}) => {
  // Setup — the order's History tab narrowed to an event the quote has no entry of, so nothing matches.
  const { history } = ordersPage.details
  await ordersPage.openOrderHistory(order.id)
  await history.filterByEvent(UNMATCHED_HISTORY_EVENT)
  await history.noMatch.waitFor()

  // Act — the filter bar stayed, so the filter can be cleared.
  await history.clearFilters.click()

  // Assert — the order's entries are listed again.
  await expect(history.ofType(ORDER_CREATED_HISTORY_EVENT)).toBeVisible()
})
