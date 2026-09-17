import { expect, test, NEW_ORDER_STATUS } from './fixtures/orders'
import { OrdersPOM } from './pom/OrdersPOM'

// Both tests leave an order behind; the `customer` / `newCustomer` fixtures
// remove it with its customer, so neither test needs a cleanup stage.

test.describe('new order', () => {
  test('creates a quote for an existing customer', async ({ page, customer }) => {
    // Setup — find the fixture's customer in the new-order dialog and pick it.
    const orders = new OrdersPOM(page)
    const dialog = orders.newOrderDialog
    await orders.sidebar.newOrderButton.click()
    await dialog.customerSearch.fill(customer.name)
    await dialog.customerOption(customer.id).click()

    // Assert — the created order opens as a quote for that customer.
    await dialog.submit.click()
    await expect(orders.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
    await expect(orders.details.root).toHaveAttribute('data-customer-id', customer.id)
  })

  test('creates a quote for a customer created on the spot', async ({ page, newCustomer }) => {
    // Setup — create the customer from inside the new-order dialog; saving makes it the pick.
    const orders = new OrdersPOM(page)
    await orders.sidebar.newOrderButton.click()
    await orders.newOrderDialog.newCustomer.click()
    await orders.customerDialog.name.fill(newCustomer.name)
    await orders.customerDialog.email.fill(newCustomer.email)
    await orders.customerDialog.submit.click()

    // Assert — the created order opens as a quote for the customer just saved.
    await orders.newOrderDialog.submit.click()
    await expect(orders.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
    await expect(orders.details.customerName).toHaveText(newCustomer.name)
  })
})
