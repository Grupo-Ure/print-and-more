import { expect, test } from '../../fixtures/orders'
import { FULL_CUSTOMER, FULL_CUSTOMER_ADDRESS } from '../../fixtures/customers'

test.describe('customer with every contact and address field set', () => {
  test.use({ customerSeed: FULL_CUSTOMER })

  test('the header shows the order number and the customer\'s name, email, phone and address', async ({ ordersPage, order }) => {
    // Setup — the header of the order under test.
    const header = ordersPage.details

    // Act — open the order.
    await ordersPage.openOrder(order.id)

    // Assert — every value the fixture carries is on screen.
    await expect(header.orderNumber).toHaveText(order.orderNumber)
    await expect(header.customerName).toHaveText(FULL_CUSTOMER.name)
    await expect(header.customerEmail).toContainText(FULL_CUSTOMER.email)
    await expect(header.customerPhone).toContainText(FULL_CUSTOMER.phone)
    await expect(header.customerAddress).toContainText(FULL_CUSTOMER_ADDRESS)
  })

  test('the copy button next to the order number puts it on the clipboard', async ({ ordersPage, order, clipboard }) => {
    // Setup — the order open, the clipboard empty.
    await ordersPage.openOrder(order.id)
    await clipboard.clear()

    // Act — copy the order number.
    await ordersPage.details.copyOrderNumber.click()

    // Assert — the clipboard holds it.
    await expect.poll(() => clipboard.read()).toBe(order.orderNumber)
  })

  test('the copy button next to the email puts it on the clipboard', async ({ ordersPage, order, clipboard }) => {
    // Setup — the order open, the clipboard empty.
    await ordersPage.openOrder(order.id)
    await clipboard.clear()

    // Act — copy the email.
    await ordersPage.details.copyCustomerEmail.click()

    // Assert — the clipboard holds it.
    await expect.poll(() => clipboard.read()).toBe(FULL_CUSTOMER.email)
  })

  test('the copy button next to the phone number puts it on the clipboard', async ({ ordersPage, order, clipboard }) => {
    // Setup — the order open, the clipboard empty.
    await ordersPage.openOrder(order.id)
    await clipboard.clear()

    // Act — copy the phone number.
    await ordersPage.details.copyCustomerPhone.click()

    // Assert — the clipboard holds it.
    await expect.poll(() => clipboard.read()).toBe(FULL_CUSTOMER.phone)
  })

  test('the copy button next to the address puts it on the clipboard', async ({ ordersPage, order, clipboard }) => {
    // Setup — the order open, the clipboard empty.
    await ordersPage.openOrder(order.id)
    await clipboard.clear()

    // Act — copy the address.
    await ordersPage.details.copyCustomerAddress.click()

    // Assert — the clipboard holds it.
    await expect.poll(() => clipboard.read()).toBe(FULL_CUSTOMER_ADDRESS)
  })
})
