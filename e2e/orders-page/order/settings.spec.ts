import { expect, test, nextOrderDeadline } from '../../fixtures/orders'

test('picking a date in the deadline calendar sets it as the order deadline', async ({ ordersPage, order }) => {
  // Setup — a date the picker accepts.
  const deadline = nextOrderDeadline()
  const picker = ordersPage.details.deadline

  // Act — open the order and pick the date in the deadline calendar.
  await ordersPage.sidebar.row(order.id).click()
  await picker.pick(deadline)

  // Assert — the settings row shows that deadline for the order.
  await expect(ordersPage.details.forOrder(order.id)).toBeVisible()
  await expect(picker.trigger).toHaveAttribute('data-value', deadline)
})
