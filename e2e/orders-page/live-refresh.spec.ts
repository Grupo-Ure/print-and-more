import { expect, test, nextOrderDeadline, IN_PROGRESS_STATUS } from '../fixtures/orders'
import { OTHER_PRODUCT } from '../fixtures/products'

// Every change here is written through the runner's own database connection,
// which stands in for another user or for a step the database takes itself.
// Nothing is clicked in the app and nothing is reloaded: what the view shows
// afterwards reached it through its realtime subscription.

test('ORD-LIVE-001 changing the open order\'s deadline outside the app shows it in the header without a reload', async ({ ordersPage, database, order }) => {
  // Setup — a deadline the quote does not have yet, with the order open.
  const deadline = nextOrderDeadline()
  await ordersPage.openOrder(order.id)

  // Act — set the deadline in the database.
  await database.updateOrderDeadline(order.id, deadline)

  // Assert — the settings row shows that deadline.
  await expect(ordersPage.details.deadline.trigger).toHaveAttribute('data-value', deadline)
})

test('ORD-LIVE-002 adding a product to the open order outside the app lists it in the product list without a reload', async ({ ordersPage, database, order }) => {
  // Setup — the order open, with no product in it.
  await ordersPage.openOrder(order.id)
  await ordersPage.details.productList.empty.waitFor()

  // Act — insert a product for the order in the database.
  const product = await database.createProduct(order.id, OTHER_PRODUCT)

  // Assert — the product list has its row.
  await expect(ordersPage.details.productList.row(product.id)).toBeVisible()
})

test('ORD-LIVE-003 changing the status of a listed order outside the app shows it on the order\'s row without a reload', async ({ ordersPage, database, order }) => {
  // Setup — the quote listed in the sidebar, not opened.
  const row = ordersPage.sidebar.row(order.id)
  await row.waitFor()

  // Act — move the order to in progress in the database.
  await database.updateOrderStatus(order.id, IN_PROGRESS_STATUS)

  // Assert — the row's status badge shows it in progress.
  await expect(ordersPage.sidebar.rowStatus(row)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
})
