import {
  expect,
  test,
  COMPLETE_QUOTE_ORDER,
  SETTINGS_CHANGED_HISTORY_EVENT,
  defaultOrderDeadline,
  nextOrderDeadline,
} from '../../fixtures/orders'

test('ORD-SET-001 picking a date in the deadline calendar sets it as the order deadline', async ({ ordersPage, order }) => {
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

test.describe('quote with deadline and delivery', () => {
  test.use({ orderSeed: COMPLETE_QUOTE_ORDER })

  test('ORD-SET-002 changing the order deadline records the previous and the new date in the order history', async ({ ordersPage, database, order }) => {
    // Setup — the deadline the order was seeded with and a different one the picker accepts, with the order open.
    const previous = nextOrderDeadline()
    const next = defaultOrderDeadline()
    const picker = ordersPage.details.deadline
    await ordersPage.openOrder(order.id)

    // Act — pick the other date in the calendar, then open the order's history.
    await picker.trigger.click()
    await picker.showMonthOf(next)
    await picker.day(next).click()
    await ordersPage.details.historyTab.click()

    // Assert — the history shows one settings change, and the one entry stored holds both dates.
    await expect(ordersPage.details.history.ofType(SETTINGS_CHANGED_HISTORY_EVENT)).toHaveCount(1)
    expect(await database.historyEntries(order.id, SETTINGS_CHANGED_HISTORY_EVENT)).toEqual([
      expect.objectContaining({ meta: expect.objectContaining({ previous, next }) }),
    ])
  })

  test('ORD-SET-003 picking the selected day again keeps the order deadline', async ({ ordersPage, order }) => {
    // Setup — the deadline the order was seeded with, with the order open.
    const deadline = nextOrderDeadline()
    const picker = ordersPage.details.deadline
    await ordersPage.openOrder(order.id)

    // Act — open the calendar and click the day that is already selected.
    await picker.trigger.click()
    await picker.showMonthOf(deadline)
    await picker.day(deadline).click()

    // Assert — the deadline is still set: a deadline can be changed, not removed.
    await expect(picker.trigger).toHaveAttribute('data-value', deadline)
  })
})
