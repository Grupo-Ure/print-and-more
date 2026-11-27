import { expect, test } from '../../fixtures/orders'

// Time is logged on a product from pre-press on: a product in setup can still
// be deleted, and its logs would go with it. The database refuses the log
// (CMP-LOCK-038); the app offers no way to write one. The default seed is a
// quote whose product is in setup.

test('PRD-TIM-001 the Basic info tab of a product in setup offers no quick time log', async ({ ordersPage, product }) => {
  // Setup — the product open on its Basic info tab (the default), the tab on screen.
  const { basicInfo, quickTimeLog } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)
  await basicInfo.root.waitFor()

  // Assert — the quick-log widget is not there.
  await expect(quickTimeLog.root).not.toBeAttached()
})

test('PRD-TIM-002 opening the Time logs tab of a product in setup shows no entry form', async ({ ordersPage, product }) => {
  // Setup — the product open.
  const productDetail = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Act
  await productDetail.timeLogsTab.click()

  // Assert — the tab is on screen, without the minutes field to log time with.
  await expect(productDetail.timeLogs.root).toBeVisible()
  await expect(productDetail.timeLogs.minutes).not.toBeAttached()
})
