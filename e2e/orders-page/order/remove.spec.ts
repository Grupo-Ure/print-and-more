import { expect, test } from '../../fixtures/orders'

test('archiving an order removes it from the order list', async ({ ordersPage, order }) => {
  // Act — open the order, archive it and confirm.
  await ordersPage.sidebar.row(order.id).click()
  await ordersPage.details.archive.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is gone from the list and nothing is selected.
  await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
  await expect(ordersPage.welcome).toBeVisible()
})

test('cancelling an order removes it from the order list', async ({ ordersPage, order }) => {
  // Act — open the order, cancel it and confirm.
  await ordersPage.sidebar.row(order.id).click()
  await ordersPage.details.cancel.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is gone from the list and nothing is selected.
  await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
  await expect(ordersPage.welcome).toBeVisible()
})

test('deleting a quote from its row menu removes it from the order list', async ({ ordersPage, order }) => {
  // Setup — the quote's row in the sidebar.
  const row = ordersPage.sidebar.row(order.id)

  // Act — open the row's menu, delete the quote and confirm.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDelete.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the quote is gone from the list.
  await expect(row).toHaveCount(0)
})
