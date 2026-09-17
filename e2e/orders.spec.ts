import { expect, test } from './fixtures/orders'

test.describe('orders view', () => {
  test('lists the order, and selecting it loads its details', async ({ ordersPage, order }) => {
    // Setup — signed in; the fixture created a quote and reloaded the list.
    const row = ordersPage.sidebar.row(order.id)

    // Assert — the sidebar lists it; selecting it opens that order's details.
    await expect(row).toBeVisible()
    await row.click()
    await expect(ordersPage.details.root).toHaveAttribute('data-order-id', order.id)
  })
})
