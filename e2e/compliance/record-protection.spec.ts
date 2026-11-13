import { NEW_CUSTOMER } from '../fixtures/customers'
import {
  BILLED_STATUS,
  BILLED_WITHIN_RETENTION_ORDER,
  FINISHED_ORDER,
  FINISHED_STATUS,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_STATUS,
  expect,
  test,
} from '../fixtures/orders'
import { DONE_STATUS, OTHER_PRODUCT, PREPRESS_STATUS, PRODUCT_DONE, PRODUCT_IN_PRODUCTION } from '../fixtures/products'
import {
  CLOSED_ORDER_BILLING_NOTE,
  LOCKED_TIME_LOG_MINUTES,
  OTHER_PAYMENT_METHOD,
  QUOTE_HISTORY_EVENT,
  RELEASED_PRODUCT_FILE,
  SETUP_PRODUCT_FILE,
} from '../fixtures/recordProtection'
import { TEST_USERS } from '../fixtures/users'

// Driven against the database, no screen involved, like APR-REL: a signed-in
// admin — the strongest app role — writes what the app never offers, and the
// outcome is read back through the runner's connection. The guards of
// 20261103115958_gobd_record_protection are the subject; the app hides what
// they refuse, so a user only ever meets them through a stale view.

// ── A closed order is the record ──────────────────────────────────────────

test.describe('as admin, finished order, done product with a file link and a time log', () => {
  test.use({ orderSeed: FINISHED_ORDER, productSeed: PRODUCT_DONE })

  test('CMP-LOCK-001 deleting the order is refused', async ({ database, order }) => {
    // Setup — a connection that writes as the admin, not as the runner.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').delete().eq('id', order.id)

    // Assert — refused, and the order still there.
    expect(error).not.toBeNull()
    expect(await database.orderExists(order.id)).toBe(true)
  })

  test('CMP-LOCK-002 deleting the done product is refused', async ({ database, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', product.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.productExists(product.id)).toBe(true)
  })

  test("CMP-LOCK-003 deleting the order's file is refused", async ({ database, orderFile }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('files').delete().eq('id', orderFile.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.fileExists(orderFile.id)).toBe(true)
  })

  test("CMP-LOCK-004 removing the done product's file link is refused", async ({ database, product, orderFile }) => {
    // Setup — the file attached to the product, and the admin's connection.
    await database.attachFileToProduct(product.id, orderFile.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('product_files').delete().eq('product_id', product.id).eq('file_id', orderFile.id)

    // Assert — refused, the link still there.
    expect(error).not.toBeNull()
    expect(await database.productFileCount(product.id)).toBe(1)
  })

  test("CMP-LOCK-005 deleting the product's time log is refused", async ({ database, product }) => {
    // Setup — time logged on the done product, and the admin's connection.
    const logId = await database.createTimeLog(product.id, TEST_USERS.admin, LOCKED_TIME_LOG_MINUTES)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('product_time_logs').delete().eq('id', logId)

    // Assert — refused, the log still there.
    expect(error).not.toBeNull()
    expect(await database.timeLogCount(product.id)).toBe(1)
  })

  test("CMP-LOCK-006 changing the order's customer is refused", async ({ database, order }) => {
    // Setup — another customer to move the order to, and the admin's connection.
    const other = await database.createCustomer(NEW_CUSTOMER)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').update({ customer_id: other.id }).eq('id', order.id)

    // Assert — refused, the order still with its customer.
    expect(error).not.toBeNull()
    expect((await database.orderState(order.id)).customer_id).toBe(order.customerId)

    // Cleanup — the other customer has no orders, so it goes on its own.
    await database.removeCustomer(other.id)
  })

  test("CMP-LOCK-007 changing the order's payment method is refused", async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').update({ payment_method: OTHER_PAYMENT_METHOD }).eq('id', order.id)

    // Assert
    expect(error).not.toBeNull()
    expect((await database.orderState(order.id)).payment_method).toBe(FINISHED_ORDER.paymentMethod)
  })

  test("CMP-LOCK-008 changing the done product's status is refused", async ({ database, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — back to pre-press, a status the app may otherwise write itself.
    const { error } = await asAdmin.from('products').update({ status: PREPRESS_STATUS }).eq('id', product.id)

    // Assert
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(DONE_STATUS)
  })

  test("CMP-LOCK-009 changing the order's billing note saves it", async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').update({ billing_note: CLOSED_ORDER_BILLING_NOTE }).eq('id', order.id)

    // Assert — the one header field a closed order keeps open.
    expect(error).toBeNull()
    expect((await database.orderState(order.id)).billing_note).toBe(CLOSED_ORDER_BILLING_NOTE)
  })

  test('CMP-LOCK-010 archiving the order saves it', async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').update({ is_archived: true }).eq('id', order.id)

    // Assert
    expect(error).toBeNull()
    expect((await database.orderState(order.id)).is_archived).toBe(true)
  })

  test('CMP-LOCK-011 reopening the order moves it to in progress', async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — the lifecycle's way out of finished.
    const { error } = await asAdmin.from('orders').update({ status: IN_PROGRESS_STATUS }).eq('id', order.id)

    // Assert
    expect(error).toBeNull()
    expect((await database.orderState(order.id)).status).toBe(IN_PROGRESS_STATUS)
  })
})

test.describe('as admin, billed order', () => {
  test.use({ orderSeed: BILLED_WITHIN_RETENTION_ORDER })

  test('CMP-LOCK-012 changing the status of the billed order is refused', async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — back to finished, the status it came from.
    const { error } = await asAdmin.from('orders').update({ status: FINISHED_STATUS }).eq('id', order.id)

    // Assert — billed is final.
    expect(error).not.toBeNull()
    expect((await database.orderState(order.id)).status).toBe(BILLED_STATUS)
  })

  test("CMP-LOCK-013 deleting the order's customer is refused", async ({ database, customer, order }) => {
    // Setup — the billed order stands on the customer; the admin's connection.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('customers').delete().eq('id', customer.id)

    // Assert — refused, the customer still there with the order.
    expect(error).not.toBeNull()
    expect(await database.customerExists(customer.id)).toBe(true)
    expect(await database.orderExists(order.id)).toBe(true)
  })
})

// ── An order in progress: released work is the record, setup is not ───────

test.describe('as admin, in progress order, one product in production and one in setup, a file linked to each', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeeds: [[PRODUCT_IN_PRODUCTION, OTHER_PRODUCT], { scope: 'test' }] })

  test('CMP-LOCK-014 deleting the order is refused', async ({ database, order, products }) => {
    // Setup — the order holds released work; the admin's connection.
    expect(products).toHaveLength(2)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').delete().eq('id', order.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.orderExists(order.id)).toBe(true)
  })

  test('CMP-LOCK-015 deleting the released product is refused', async ({ database, products }) => {
    // Setup
    const [released] = products
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', released.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.productExists(released.id)).toBe(true)
  })

  test("CMP-LOCK-016 removing the released product's file link is refused", async ({ database, order, products }) => {
    // Setup — the file linked to the order and attached to the released product.
    const [released] = products
    const file = await database.createFile(order.id, RELEASED_PRODUCT_FILE)
    await database.attachFileToProduct(released.id, file.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('product_files').delete().eq('product_id', released.id).eq('file_id', file.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.productFileCount(released.id)).toBe(1)
  })

  test('CMP-LOCK-017 deleting the setup product removes it', async ({ database, products }) => {
    // Setup
    const [, inSetup] = products
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', inSetup.id)

    // Assert — a product still in setup is no record yet.
    expect(error).toBeNull()
    expect(await database.productExists(inSetup.id)).toBe(false)
  })

  test("CMP-LOCK-018 deleting the setup product's file removes it", async ({ database, order, products }) => {
    // Setup — the file linked to the order and attached to the setup product only.
    const [, inSetup] = products
    const file = await database.createFile(order.id, SETUP_PRODUCT_FILE)
    await database.attachFileToProduct(inSetup.id, file.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('files').delete().eq('id', file.id)

    // Assert — a working link on an open order may still be corrected.
    expect(error).toBeNull()
    expect(await database.fileExists(file.id)).toBe(false)
  })

  test("CMP-LOCK-019 deleting the released product's file is refused", async ({ database, order, products }) => {
    // Setup — the file linked to the order and attached to the released product.
    const [released] = products
    const file = await database.createFile(order.id, RELEASED_PRODUCT_FILE)
    await database.attachFileToProduct(released.id, file.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — the file row itself, whose delete would take the link with it.
    const { error } = await asAdmin.from('files').delete().eq('id', file.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.fileExists(file.id)).toBe(true)
  })
})

// ── A quote is deleted through one function, history in the open ──────────

test.describe('as admin, quote with a history entry', () => {
  test('CMP-LOCK-020 deleting the history entry is refused', async ({ database, order }) => {
    // Setup — one entry on the quote, and the admin's connection.
    const entryId = await database.createHistoryEntry(order.id, QUOTE_HISTORY_EVENT)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('history').delete().eq('id', entryId)

    // Assert — history is append-only, whatever the order's state.
    expect(error).not.toBeNull()
    expect(await database.historyEntryExists(entryId)).toBe(true)
  })

  test('CMP-LOCK-021 deleting the quote row directly is refused', async ({ database, order }) => {
    // Setup
    await database.createHistoryEntry(order.id, QUOTE_HISTORY_EVENT)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — around delete_quote.
    const { error } = await asAdmin.from('orders').delete().eq('id', order.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.orderExists(order.id)).toBe(true)
  })

  test('CMP-LOCK-022 deleting the quote through the function removes it with its history', async ({ database, order }) => {
    // Setup
    await database.createHistoryEntry(order.id, QUOTE_HISTORY_EVENT)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — what the sidebar's row menu calls.
    const { error } = await asAdmin.rpc('delete_quote', { p_order_id: order.id })

    // Assert — the quote and its history are gone.
    expect(error).toBeNull()
    expect(await database.orderExists(order.id)).toBe(false)
    expect(await database.historyCount(order.id, QUOTE_HISTORY_EVENT)).toBe(0)
  })
})
