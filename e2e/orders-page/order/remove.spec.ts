import {
  expect,
  test,
  IN_PROGRESS_ORDER,
  ORDER_ARCHIVED_HISTORY_EVENT,
  ORDER_CANCELLED_HISTORY_EVENT,
} from '../../fixtures/orders'
import { PRODUCT_CANCELLED_HISTORY_EVENT, TWO_PRODUCTS_IN_PREPRESS } from '../../fixtures/products'

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

test.describe('in progress, two products in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeeds: [TWO_PRODUCTS_IN_PREPRESS, { scope: 'test' }] })

  test('ORD-REM-004 cancelling an order cancels every product and records the cancel as one action', async ({
    ordersPage,
    database,
    order,
    products,
  }) => {
    // Setup — the order open.
    await ordersPage.openOrder(order.id)

    // Act — cancel it, confirm, and wait until the app has let go of it.
    await ordersPage.details.cancel.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.welcome.waitFor()

    // Assert — both products cancelled and the order archived; one entry for the cancel, one per product and one
    // for the archiving, all in the cancel's action.
    const productStates = await Promise.all(products.map(product => database.productState(product.id)))
    const [cancelActionId, ...otherCancels] = await database.historyActionIds(order.id, ORDER_CANCELLED_HISTORY_EVENT)
    expect(productStates.map(state => state.is_cancelled)).toEqual(products.map(() => true))
    expect((await database.orderState(order.id)).is_archived).toBe(true)
    expect([cancelActionId, ...otherCancels]).toEqual([expect.any(String)])
    expect(await database.historyActionIds(order.id, PRODUCT_CANCELLED_HISTORY_EVENT)).toEqual(products.map(() => cancelActionId))
    expect(await database.historyActionIds(order.id, ORDER_ARCHIVED_HISTORY_EVENT)).toEqual([cancelActionId])
  })
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
