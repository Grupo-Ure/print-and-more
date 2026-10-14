import { expect, test } from '../../fixtures/orders'

test('ORD-REM-001 archiving an order removes it from the order list', async ({ ordersPage, order }) => {
  // Setup — the order open.
  await ordersPage.openOrder(order.id)

  // Act — archive it and confirm.
  await ordersPage.details.archive.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is gone from the list and nothing is selected.
  await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
  await expect(ordersPage.welcome).toBeVisible()
})

test('ORD-REM-002 cancelling an order removes it from the order list', async ({ ordersPage, order }) => {
  // Setup — the order open.
  await ordersPage.openOrder(order.id)

  // Act — cancel it and confirm.
  await ordersPage.details.cancel.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is gone from the list and nothing is selected.
  await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
  await expect(ordersPage.welcome).toBeVisible()
})

test('ORD-REM-003 deleting a quote from its row menu removes it from the order list', async ({ ordersPage, order }) => {
  // Setup — the quote's row in the sidebar.
  const row = ordersPage.sidebar.row(order.id)

  // Act — open the row's menu, delete the quote and confirm.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDelete.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the quote is gone from the list.
  await expect(row).toHaveCount(0)
})
