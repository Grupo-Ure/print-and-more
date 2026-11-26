import { expect, test } from '../fixtures/stock'
import {
  IN_STOCK_MODEL_STOCK_AFTER_PAGE_BOOKING,
  IN_STOCK_STAMP_MODEL,
  STOCK_BOOKED_HISTORY_EVENT,
  STOCK_PAGE_INBOUND_ENTRY,
  STOCK_PAGE_INBOUND_QUANTITY,
} from '../fixtures/stamps'
import { TEST_USERS } from '../fixtures/users'

// A booking by hand on a stock page: the page books through `book_stock`, and
// its movement list reads the stock entries of the history. The `catalog`
// fixture resets the model's stock and removes its entries around every test.

test.describe('as admin, stamp stock page', () => {
  test.use({ user: TEST_USERS.admin })

  test('STK-BOOK-001 booking stock in on the stamp stock page shows it in the movement list', async ({ stampStockPage, database }) => {
    // Setup — the stamp stock page narrowed to the in-stock model.
    const row = stampStockPage.table.row(IN_STOCK_STAMP_MODEL.id)
    const booking = stampStockPage.table.booking(row)
    await stampStockPage.openOnModel(IN_STOCK_STAMP_MODEL.name, IN_STOCK_STAMP_MODEL.id)

    // Act — book the pieces in on the model's row, then open the movement list.
    await booking.quantity.fill(String(STOCK_PAGE_INBOUND_QUANTITY))
    await booking.increase.click()
    await stampStockPage.movementsButton.click()

    // Assert — the row shows the raised stock, and the list has the line of the one entry recorded: inbound, of that quantity.
    await expect(stampStockPage.table.rowStock(row)).toHaveAttribute('data-stock', String(IN_STOCK_MODEL_STOCK_AFTER_PAGE_BOOKING))
    const entries = await database.stampStockEntries(IN_STOCK_STAMP_MODEL.id, STOCK_BOOKED_HISTORY_EVENT)
    expect(entries).toEqual([expect.objectContaining({ meta: expect.objectContaining(STOCK_PAGE_INBOUND_ENTRY) })])
    await expect(stampStockPage.movementRow(entries[0].id)).toBeVisible()
  })
})
