import { expect, test, IN_PROGRESS_STATUS } from '../../../fixtures/orders'

test.describe('order status', () => {
  test('starting processing a quote moves the order to in progress', async ({ ordersPage, order }) => {
    // Act — open the order, start processing and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is shown in progress.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})
