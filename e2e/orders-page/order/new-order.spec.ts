import { expect, test, NEW_ORDER_STATUS, defaultOrderDeadline } from '../../fixtures/orders'

// Every test leaves an order behind; the `customer` / `newCustomer` fixtures
// remove it with its customer, so none of them needs a cleanup stage.

test('creating an order for an existing customer opens it as a quote for that customer', async ({ ordersPage, customer }) => {
  // Setup — the `customer` fixture inserted the customer row.
  const dialog = ordersPage.newOrderDialog

  // Act — find the fixture's customer in the new-order dialog, pick it and submit.
  await ordersPage.sidebar.newOrderButton.click()
  await dialog.customerSearch.fill(customer.name)
  await dialog.customerOption(customer.id).click()
  await dialog.submit.click()

  // Assert — the created order opens as a quote for that customer.
  await expect(ordersPage.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
  await expect(ordersPage.details.root).toHaveAttribute('data-customer-id', customer.id)
})

test('creating an order with a customer created in the dialog opens it as a quote for that customer', async ({ ordersPage, newCustomer }) => {
  // Act — create the customer from inside the new-order dialog (saving makes it the pick), then submit.
  await ordersPage.sidebar.newOrderButton.click()
  await ordersPage.newOrderDialog.newCustomer.click()
  await ordersPage.customerDialog.name.fill(newCustomer.name)
  await ordersPage.customerDialog.email.fill(newCustomer.email)
  await ordersPage.customerDialog.submit.click()
  await ordersPage.newOrderDialog.submit.click()

  // Assert — the created order opens as a quote for the customer just saved.
  await expect(ordersPage.details.root).toHaveAttribute('data-status', NEW_ORDER_STATUS)
  await expect(ordersPage.details.customerName).toHaveText(newCustomer.name)
})

test('creating an order pre-fills its deadline one week out', async ({ ordersPage, customer }) => {
  // Setup — the `customer` fixture inserted the customer row; the deadline a new order is expected to carry.
  const dialog = ordersPage.newOrderDialog
  const deadline = defaultOrderDeadline()

  // Act — create an order for that customer without touching any setting.
  await ordersPage.sidebar.newOrderButton.click()
  await dialog.customerSearch.fill(customer.name)
  await dialog.customerOption(customer.id).click()
  await dialog.submit.click()

  // Assert — the settings row of the created order shows the deadline a week from today.
  await expect(ordersPage.details.deadline.trigger).toHaveAttribute('data-value', deadline)
})
