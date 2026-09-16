import { expect, test } from './fixtures/orders'
import { OrdersPOM } from './pom/OrdersPOM'

test.describe('orders view', () => {
  test('lists the order, and selecting it loads its details', async ({ page, order }) => {
    // Setup — signed in; the fixture created a quote and reloaded the list.
    const orders = new OrdersPOM(page)
    const row = orders.sidebar.row(order.id)

    // Assert — the sidebar lists it; selecting it opens that order's details.
    await expect(row).toBeVisible()
    await row.click()
    await expect(orders.details.root).toHaveAttribute('data-order-id', order.id)
  })
})
