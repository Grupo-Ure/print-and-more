import { expect, test } from '../fixtures/approvals'
import { CHANGES_REQUESTED_REQUEST } from '../fixtures/approvalRequests'
import { IN_PROGRESS_ORDER } from '../fixtures/orders'
import {
  AWAITING_APPROVAL_STATUS,
  BLANK_FORCE_RELEASE_REASON,
  FORCE_RELEASE_HISTORY_EVENT,
  FORCE_RELEASE_REASON,
  IN_PRODUCTION_STATUS,
  NEW_PRODUCT_STATUS,
  OTHER_PRODUCT,
  PREPRESS_STATUS,
  IN_STOCK_MODEL_STOCK_AFTER_RELEASE,
  PRODUCT_IN_PREPRESS,
  RELEASE_HISTORY_EVENT,
  STAMP_PRODUCT_IN_PREPRESS_IN_STOCK,
  STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK,
  releaseDeductionEntry,
} from '../fixtures/products'
import { STOCK_DEDUCTED_HISTORY_EVENT } from '../fixtures/recordProtection'
import {
  DIRECT_STOCK_OF_IN_STOCK_MODEL,
  IN_STOCK_MODEL_STOCK_AFTER_INBOUND,
  IN_STOCK_STAMP_MODEL,
  INBOUND_BOOKING_ENTRY,
  INBOUND_BOOKING_OF_IN_STOCK_MODEL,
  OUT_OF_STOCK_STAMP_MODEL,
  OUTBOUND_BOOKING_OF_IN_STOCK_MODEL,
  OVERDRAWN_BOOKING_OF_IN_STOCK_MODEL,
  STOCK_BOOKED_HISTORY_EVENT,
} from '../fixtures/stamps'
import { NEW_TEXTILE_BRAND } from '../fixtures/textiles'
import { TEST_USERS } from '../fixtures/users'

// Driven against the database, no screen involved, like APR-REQ: a signed-in
// session calls what the app calls — or writes what it must not — and the
// outcome is read back through the runner's connection. The two release
// functions are the only way into production; the release gates in the app
// mirror them. The stock they book is the other half: a stock number changes
// only together with its history entry, through a release or `book_stock`.

// ── Around the release functions ──────────────────────────────────────────

test.describe('in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test("APR-REL-001 updating the product's status to production directly is refused", async ({ database, product }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — release by hand, around the release function.
    const { error } = await asEmployee.from('products').update({ status: IN_PRODUCTION_STATUS }).eq('id', product.id)

    // Assert — refused, and the product still in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })

  test('APR-REL-002 force releasing the product as an employee is refused', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('force_release_to_production', {
      product_id: product.id,
      reason: FORCE_RELEASE_REASON,
    })

    // Assert — refused, and the product still in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

// The default quote seed holds the product in setup.
test.describe('quote, product in setup', () => {
  test.use({ productSeed: OTHER_PRODUCT })

  test('APR-REL-012 moving the product from setup to pre-press directly is refused', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — the step that is the database's own, written by hand.
    const { error } = await asEmployee.from('products').update({ status: PREPRESS_STATUS }).eq('id', product.id)

    // Assert — refused, and the product still in setup.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(NEW_PRODUCT_STATUS)
  })
})

// ── The plain release's gates ─────────────────────────────────────────────

// Only a product in pre-press is released; the default quote seed holds this one in setup.
test.describe('quote, product in setup', () => {
  test.use({ productSeed: OTHER_PRODUCT })

  test('APR-REL-003 releasing the product is refused', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — a product in setup does not reach production.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(NEW_PRODUCT_STATUS)
  })
})

test.describe('in progress, stamp product in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('APR-REL-004 releasing the product is refused and books nothing', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — refused, still in pre-press, and no deduction against the model.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
    expect(await database.stampStockDeductions(OUT_OF_STOCK_STAMP_MODEL.id)).toEqual([])
  })
})

test.describe('newest round came back with changes', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: CHANGES_REQUESTED_REQUEST })

  test('APR-REL-005 releasing the product is refused', async ({ database, product, approvalRequest: _changes }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — the customer did not approve this round, so it stays in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

// ── The waiting product ───────────────────────────────────────────────────

test.describe('waiting stamp product, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test('APR-REL-006 releasing the product is refused and books nothing', async ({ database, product, approvalRequest: _waiting }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — refused, still waiting, and the model untouched.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(AWAITING_APPROVAL_STATUS)
    expect(await database.stampStockDeductions(IN_STOCK_STAMP_MODEL.id)).toEqual([])
  })
})

test.describe('as admin, waiting stamp product, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test('APR-REL-007 force releasing the product is refused and books nothing', async ({ database, product, approvalRequest: _waiting }) => {
    // Setup — a connection that writes as the admin.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.rpc('force_release_to_production', {
      product_id: product.id,
      reason: FORCE_RELEASE_REASON,
    })

    // Assert — not even an admin overrides an open round: still waiting, and the model untouched.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(AWAITING_APPROVAL_STATUS)
    expect(await database.stampStockDeductions(IN_STOCK_STAMP_MODEL.id)).toEqual([])
  })
})

// ── The force release ─────────────────────────────────────────────────────

test.describe('as admin, in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-REL-008 force releasing the product without a reason is refused', async ({ database, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.rpc('force_release_to_production', {
      product_id: product.id,
      reason: BLANK_FORCE_RELEASE_REASON,
    })

    // Assert — refused, and the product still in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

test.describe('as admin, in progress, stamp product in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('APR-REL-009 force releasing the product moves it to production past the shortage', async ({ database, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    await asAdmin.rpc('force_release_to_production', { product_id: product.id, reason: FORCE_RELEASE_REASON })

    // Assert — in production, with the empty model left at zero.
    expect((await database.productState(product.id)).status).toBe(IN_PRODUCTION_STATUS)
    expect(await database.stampModelStock(OUT_OF_STOCK_STAMP_MODEL.id)).toBe(OUT_OF_STOCK_STAMP_MODEL.stock)
  })

  test('APR-REL-010 force releasing the product records the reason in the emergency entry', async ({ database, order, product }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    await asAdmin.rpc('force_release_to_production', { product_id: product.id, reason: FORCE_RELEASE_REASON })

    // Assert — one emergency entry, carrying the reason.
    expect((await database.historyEntries(order.id, FORCE_RELEASE_HISTORY_EVENT)).map(entry => entry.reason)).toEqual([
      FORCE_RELEASE_REASON,
    ])
  })
})

// ── What a release books ──────────────────────────────────────────────────

test.describe('in progress, stamp product in pre-press, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test("APR-REL-013 releasing the product records the model's deduction in the history, in the release's action", async ({
    database,
    order,
    product,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — one entry against the model, about this product, in the release's own action; the stock down by the quantity.
    const deductions = await database.stampStockEntries(IN_STOCK_STAMP_MODEL.id, STOCK_DEDUCTED_HISTORY_EVENT)
    const [releaseActionId] = await database.historyActionIds(order.id, RELEASE_HISTORY_EVENT)
    expect(releaseActionId).toEqual(expect.any(String))
    expect(deductions).toEqual([
      expect.objectContaining({
        product_id: product.id,
        action_id: releaseActionId,
        meta: releaseDeductionEntry(order.orderNumber),
      }),
    ])
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_MODEL_STOCK_AFTER_RELEASE)
  })
})

// ── Booking on its own ────────────────────────────────────────────────────

test.describe('as employee', () => {
  test("APR-REL-011 booking the model's stock out by hand, around any release, is refused", async ({ database }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — book straight through the one booking function, around any release.
    const { error } = await asEmployee.rpc('book_stock', OUTBOUND_BOOKING_OF_IN_STOCK_MODEL)

    // Assert — refused, and the model at its seed stock.
    expect(error).not.toBeNull()
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_STAMP_MODEL.stock)
  })
})

test.describe('as admin', () => {
  test('APR-REL-014 booking stock in as an admin raises the stock and records the booking', async ({ database }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)
    const adminId = await database.userId(TEST_USERS.admin)

    // Act
    const { data: stock } = await asAdmin.rpc('book_stock', INBOUND_BOOKING_OF_IN_STOCK_MODEL)

    // Assert — the new stock returned and stored, and one entry of the booking: the admin's, about no order.
    expect(stock).toBe(IN_STOCK_MODEL_STOCK_AFTER_INBOUND)
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_MODEL_STOCK_AFTER_INBOUND)
    expect(await database.stampStockEntries(IN_STOCK_STAMP_MODEL.id, STOCK_BOOKED_HISTORY_EVENT)).toEqual([
      expect.objectContaining({ order_id: null, user_id: adminId, meta: INBOUND_BOOKING_ENTRY }),
    ])
  })

  test('APR-REL-015 booking more out than the available stock is refused', async ({ database }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.rpc('book_stock', OVERDRAWN_BOOKING_OF_IN_STOCK_MODEL)

    // Assert — refused, the model at its seed stock and no booking recorded.
    expect(error).not.toBeNull()
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_STAMP_MODEL.stock)
    expect(await database.stampStockEntries(IN_STOCK_STAMP_MODEL.id, STOCK_BOOKED_HISTORY_EVENT)).toEqual([])
  })

  test("APR-REL-016 writing an item's stock directly as an admin is refused", async ({ database }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — the stock number written by hand, around the booking function.
    const { error } = await asAdmin
      .from('stamp_models')
      .update({ stock: DIRECT_STOCK_OF_IN_STOCK_MODEL })
      .eq('id', IN_STOCK_STAMP_MODEL.id)

    // Assert — refused, and the model at its seed stock.
    expect(error).not.toBeNull()
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_STAMP_MODEL.stock)
  })
})

// ── The stock master data ─────────────────────────────────────────────────

test.describe('as employee', () => {
  test('APR-REL-017 adding a textile brand as an employee is refused', async ({ database }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.from('textile_brands').insert(NEW_TEXTILE_BRAND)

    // Assert — the catalog is an admin's to write.
    expect(error).not.toBeNull()

    // Cleanup — nothing to remove unless the insert went through.
    await database.removeTextileBrand(NEW_TEXTILE_BRAND.id)
  })
})
