import { expect, test, NEW_ORDER_STATUS } from './fixtures/orders'

// Both tests leave an order behind; the `customer` / `newCustomer` fixtures
// remove it with its customer, so neither test needs a cleanup stage.

test.describe('new order', () => {
  test('creates a quote for an existing customer', async ({ ordersPage, customer }) => {
    // Setup — find the fixture's customer in the new-order dialog and pick it.
    const dialog = ordersPage.newOrderDialog
    await ordersPage.sidebar.newOrderButton.click()
    await dialog.customerSearch.fill(customer.name)
    await dialog.customerOption(customer.id).click()

    // Assert — the created order opens as a quote for that customer.
    await dialog.submit.click()
    await expect(ordersPage.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
    await expect(ordersPage.details.root).toHaveAttribute('data-customer-id', customer.id)
  })

  test('creates a quote for a customer created on the spot', async ({ ordersPage, newCustomer }) => {
    // Setup — create the customer from inside the new-order dialog; saving makes it the pick.
    await ordersPage.sidebar.newOrderButton.click()
    await ordersPage.newOrderDialog.newCustomer.click()
    await ordersPage.customerDialog.name.fill(newCustomer.name)
    await ordersPage.customerDialog.email.fill(newCustomer.email)
    await ordersPage.customerDialog.submit.click()

    // Assert — the created order opens as a quote for the customer just saved.
    await ordersPage.newOrderDialog.submit.click()
    await expect(ordersPage.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
    await expect(ordersPage.details.customerName).toHaveText(newCustomer.name)
  })
})
