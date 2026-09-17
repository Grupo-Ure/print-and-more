import { expect, test, nextOrderDeadline } from '../../fixtures/orders'

test('picking a date in the deadline calendar sets it as the order deadline', async ({ ordersPage, order }) => {
  // Setup — a date the picker accepts, with the order open.
  const deadline = nextOrderDeadline()
  const picker = ordersPage.details.deadline
  await ordersPage.openOrder(order.id)

  // Act — open the calendar and pick the date.
  await picker.trigger.click()
  await picker.showMonthOf(deadline)
  await picker.day(deadline).click()

  // Assert — the settings row shows that deadline.
  await expect(picker.trigger).toHaveAttribute('data-value', deadline)
})
