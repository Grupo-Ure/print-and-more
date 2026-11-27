import { NEW_CUSTOMER, TEST_CUSTOMER } from '../fixtures/customers'
import {
  BILLED_STATUS,
  BILLED_WITHIN_RETENTION_ORDER,
  FINISHED_ORDER,
  FINISHED_STATUS,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_STATUS,
  NEW_ORDER_STATUS,
  defaultOrderDeadline,
  expect,
  test,
} from '../fixtures/orders'
import {
  DONE_STATUS,
  OTHER_PRODUCT,
  PREPRESS_STATUS,
  PRODUCT_DONE,
  PRODUCT_IN_PRODUCTION,
  STAMP_PRODUCT_IN_PREPRESS_IN_STOCK,
  otherProductSave,
} from '../fixtures/products'
import {
  BLANK_CUSTOMER_NAME,
  CHECK_VIOLATION,
  CLEARED_ORDER_DEADLINE,
  CLOSED_ORDER_BILLING_NOTE,
  CUSTOMER_CHANGE,
  CUSTOMER_CHANGE_ENTRIES,
  CUSTOMER_UPDATED_HISTORY_EVENT,
  DIRECT_HISTORY_EVENT,
  FILE_ADDED_HISTORY_EVENT,
  FOREIGN_KEY_VIOLATION,
  LOCKED_TIME_LOG_MINUTES,
  NOT_NULL_VIOLATION,
  OPEN_TIME_LOG_MINUTES,
  OTHER_PAYMENT_METHOD,
  QUOTE_HISTORY_EVENT,
  RELEASED_PRODUCT_FILE,
  SETUP_PRODUCT_FILE,
  STOCK_DEDUCTED_HISTORY_EVENT,
  TIME_LOGGED_HISTORY_EVENT,
  orderWithoutDeadline,
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

  test('CMP-LOCK-023 cancelling the order is refused', async ({ database, order, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — what the header's cancel calls.
    const { error } = await asAdmin.rpc('cancel_order', { p_order_id: order.id })

    // Assert — a finished order's products are the record and stay as they are, so the cancel
    // is refused as a whole: the product not cancelled, the order not archived.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).is_cancelled).toBe(false)
    expect((await database.orderState(order.id)).is_archived).toBe(false)
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

  test('CMP-LOCK-024 changing a customer records each changed field, readable by admins only', async ({ database, customer }) => {
    // Setup — the admin's connection, and an employee's to read with.
    const asAdmin = await database.asUser(TEST_USERS.admin)
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — two fields in one write as the admin, then a bounce stamped as the mail provider's report is.
    await asAdmin.from('customers').update(CUSTOMER_CHANGE).eq('id', customer.id)
    await database.stampCustomerEmailBounced(customer.id)
    const { data: seenByAdmin } = await asAdmin
      .from('history')
      .select('action_id, meta')
      .eq('customer_id', customer.id)
      .eq('event_type', CUSTOMER_UPDATED_HISTORY_EVENT)
      .order('meta->>field')
    const { data: seenByEmployee } = await asEmployee
      .from('history')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('event_type', CUSTOMER_UPDATED_HISTORY_EVENT)

    // Assert — one entry per changed field and none for the bounce, all one action; the employee is shown none of them.
    expect(seenByAdmin?.map(entry => entry.meta)).toEqual(CUSTOMER_CHANGE_ENTRIES.map(entry => expect.objectContaining(entry)))
    const [nameEntry, phoneEntry] = seenByAdmin ?? []
    expect(nameEntry.action_id).toEqual(expect.any(String))
    expect(phoneEntry.action_id).toBe(nameEntry.action_id)
    expect(seenByEmployee).toEqual([])
  })

  test('CMP-LOCK-025 adding a product to the billed order through save_product is refused', async ({ database, order }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — what saving a new product's form calls.
    const { error } = await asAdmin.rpc('save_product', otherProductSave(order.id))

    // Assert — refused, the order still without a product.
    expect(error).not.toBeNull()
    expect(await database.productCount(order.id)).toBe(0)
  })
})

// ── An order in progress: released work is the record ─────────────────────

test.describe('as admin, in progress, product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('CMP-LOCK-014 deleting the order is refused', async ({ database, order, product: _released }) => {
    // Setup — the order holds released work; the admin's connection.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('orders').delete().eq('id', order.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.orderExists(order.id)).toBe(true)
  })

  test('CMP-LOCK-015 deleting the released product is refused', async ({ database, product: released }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', released.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.productExists(released.id)).toBe(true)
  })

  test("CMP-LOCK-016 removing the released product's file link is refused", async ({ database, order, product: released }) => {
    // Setup — the file linked to the order and attached to the released product.
    const file = await database.createFile(order.id, RELEASED_PRODUCT_FILE)
    await database.attachFileToProduct(released.id, file.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('product_files').delete().eq('product_id', released.id).eq('file_id', file.id)

    // Assert
    expect(error).not.toBeNull()
    expect(await database.productFileCount(released.id)).toBe(1)
  })

  test("CMP-LOCK-019 deleting the released product's file is refused", async ({ database, order, product: released }) => {
    // Setup — the file linked to the order and attached to the released product.
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

// ── A product in setup is no record yet ───────────────────────────────────
// The default quote seed holds the product in setup.

test.describe('as admin, quote, product in setup', () => {
  test.use({ productSeed: OTHER_PRODUCT })

  test('CMP-LOCK-017 deleting the setup product removes it', async ({ database, product: inSetup }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', inSetup.id)

    // Assert — a product still in setup is no record yet.
    expect(error).toBeNull()
    expect(await database.productExists(inSetup.id)).toBe(false)
  })

  test("CMP-LOCK-018 deleting the setup product's file removes it", async ({ database, order, product: inSetup }) => {
    // Setup — the file linked to the order and attached to the setup product only.
    const file = await database.createFile(order.id, SETUP_PRODUCT_FILE)
    await database.attachFileToProduct(inSetup.id, file.id)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('files').delete().eq('id', file.id)

    // Assert — a working link on an open order may still be corrected.
    expect(error).toBeNull()
    expect(await database.fileExists(file.id)).toBe(false)
  })

  test('CMP-LOCK-027 deleting a setup product with a linked file and a time log removes their entries with it', async ({ database, order, product: inSetup }) => {
    // Setup — a file linked to the order and attached to the setup product, and time logged on it:
    // the database recorded the file, its link to the product and the log.
    const file = await database.createFile(order.id, SETUP_PRODUCT_FILE)
    await database.attachFileToProduct(inSetup.id, file.id)
    await database.createTimeLog(inSetup.id, TEST_USERS.admin, OPEN_TIME_LOG_MINUTES)
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', inSetup.id)

    // Assert — the link's entry and the log's went with the product; the file's own stays.
    expect(error).toBeNull()
    expect(await database.historyCount(order.id, FILE_ADDED_HISTORY_EVENT)).toBe(1)
    expect(await database.historyCount(order.id, TIME_LOGGED_HISTORY_EVENT)).toBe(0)
  })
})

// ── History is the database's to write ────────────────────────────────────

test.describe('as employee, quote', () => {
  test('CMP-LOCK-028 writing a history entry directly is refused', async ({ database, order }) => {
    // Setup — a connection that writes as the employee.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.from('history').insert({ order_id: order.id, event_type: DIRECT_HISTORY_EVENT })

    // Assert — refused, and the quote without an entry of that event.
    expect(error).not.toBeNull()
    expect(await database.historyCount(order.id, DIRECT_HISTORY_EVENT)).toBe(0)
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

// ── What may still be deleted takes its history along ─────────────────────

test.describe('as admin, quote with a product in setup that has a history entry', () => {
  test('CMP-LOCK-029 deleting the product removes it with its history entries', async ({ database, order, product }) => {
    // Setup — one entry about the product, and the admin's connection.
    const entryId = await database.createHistoryEntry(order.id, QUOTE_HISTORY_EVENT, { productId: product.id })
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('products').delete().eq('id', product.id)

    // Assert — the product is gone, and its entry with it.
    expect(error).toBeNull()
    expect(await database.productExists(product.id)).toBe(false)
    expect(await database.historyEntryExists(entryId)).toBe(false)
  })
})

test.describe('as admin, quote with a file that has a history entry', () => {
  test('CMP-LOCK-030 deleting the file removes it with its history entries', async ({ database, order, orderFile }) => {
    // Setup — one entry about the file, and the admin's connection.
    const entryId = await database.createHistoryEntry(order.id, QUOTE_HISTORY_EVENT, { fileId: orderFile.id })
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.from('files').delete().eq('id', orderFile.id)

    // Assert — the file is gone, and its entry with it.
    expect(error).toBeNull()
    expect(await database.fileExists(orderFile.id)).toBe(false)
    expect(await database.historyEntryExists(entryId)).toBe(false)
  })
})

test.describe('as admin, account named on a history entry', () => {
  test("CMP-LOCK-031 deleting the account's user row is refused", async ({ database, order }) => {
    // Setup — the admin changes the quote's billing note, which the database records under their name.
    const asAdmin = await database.asUser(TEST_USERS.admin)
    await asAdmin.from('orders').update({ billing_note: CLOSED_ORDER_BILLING_NOTE }).eq('id', order.id)

    // Act — the row alone, through the runner's connection: no app login may delete a user at all.
    const { error } = await database.deleteUserRow(TEST_USERS.admin)

    // Assert — the entry's link onto the user restricts, and the account is still there.
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION)
    expect(await database.userExists(TEST_USERS.admin)).toBe(true)
  })
})

test.describe('as employee, quote with a product in setup, a file linked to it and a logged time', () => {
  test('CMP-LOCK-032 deleting the quote through the function removes every entry of its products and files', async ({ database, order, product, orderFile }) => {
    // Setup — the file attached to the product and time logged on it; the database recorded each.
    await database.attachFileToProduct(product.id, orderFile.id)
    await database.createTimeLog(product.id, TEST_USERS.employee, OPEN_TIME_LOG_MINUTES)
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — what the sidebar's row menu calls.
    const { error } = await asEmployee.rpc('delete_quote', { p_order_id: order.id })

    // Assert — the quote, its product and its file are gone, and no entry about any of them is left.
    expect(error).toBeNull()
    expect(await database.orderExists(order.id)).toBe(false)
    expect(await database.productExists(product.id)).toBe(false)
    expect(await database.fileExists(orderFile.id)).toBe(false)
    expect(await database.historyCountAbout(order.id, [product.id], [orderFile.id])).toBe(0)
  })
})

// No guard limits an order's status transitions, so a direct write is how an
// order whose product was released gets back to quote.
test.describe('as employee, order put back to quote by a direct write after its product took stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test('CMP-LOCK-033 deleting a quote whose product took stock is refused', async ({ database, order, product }) => {
    // Setup — the employee releases the product, which books its stock; the order then goes back to quote.
    const asEmployee = await database.asUser(TEST_USERS.employee)
    await asEmployee.rpc('release_to_production', { product_id: product.id })
    await database.updateOrderStatus(order.id, NEW_ORDER_STATUS)

    // Act
    const { error } = await asEmployee.rpc('delete_quote', { p_order_id: order.id })

    // Assert — refused as a whole: the quote and the entry of the deduction still there.
    expect(error).not.toBeNull()
    expect(await database.orderExists(order.id)).toBe(true)
    expect(await database.historyCount(order.id, STOCK_DEDUCTED_HISTORY_EVENT)).toBe(1)
  })
})

// ── What made a product ready is never emptied ────────────────────────────
// Every order has a deadline and every customer a name and an email or phone;
// they can be changed but not removed, by anyone.

test.describe('as employee, quote', () => {
  test("CMP-LOCK-034 clearing the order's deadline is refused", async ({ database, order }) => {
    // Setup — a connection that writes as the employee; the quote carries the one-week default.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.from('orders').update(CLEARED_ORDER_DEADLINE).eq('id', order.id)

    // Assert — refused by the column itself, and the deadline still there.
    expect(error?.code).toBe(NOT_NULL_VIOLATION)
    expect(await database.orderDeadline(order.id)).toBe(defaultOrderDeadline())
  })

  test("CMP-LOCK-036 blanking the customer's name is refused", async ({ database, customer }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.from('customers').update({ name: BLANK_CUSTOMER_NAME }).eq('id', customer.id)

    // Assert — refused by the name check, and the name as seeded.
    const contact = await database.customerContact(customer.id)
    expect(error?.code).toBe(CHECK_VIOLATION)
    expect(contact.name).toBe(TEST_CUSTOMER.name)
  })

  test("CMP-LOCK-037 removing the customer's email and phone is refused", async ({ database, customer }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.from('customers').update({ email: null, phone: null }).eq('id', customer.id)

    // Assert — refused by the contact check, and the email as seeded.
    const contact = await database.customerContact(customer.id)
    expect(error?.code).toBe(CHECK_VIOLATION)
    expect(contact.email).toBe(TEST_CUSTOMER.email)
  })
})

test.describe('as employee', () => {
  test('CMP-LOCK-035 creating an order without a deadline is refused', async ({ database, customer }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — the insert the new-order dialog makes, its deadline left out.
    const { error } = await asEmployee.from('orders').insert(orderWithoutDeadline(customer.id))

    // Assert — refused by the column itself, and the customer still without an order.
    expect(error?.code).toBe(NOT_NULL_VIOLATION)
    expect(await database.customerOrderCount(customer.id)).toBe(0)
  })
})
