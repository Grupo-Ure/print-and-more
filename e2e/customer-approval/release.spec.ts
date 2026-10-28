import { expect, test } from '../fixtures/approvals'
import { CHANGES_REQUESTED_REQUEST } from '../fixtures/approvalRequests'
import { IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../fixtures/orders'
import {
  AWAITING_APPROVAL_STATUS,
  BLANK_FORCE_RELEASE_REASON,
  FORCE_RELEASE_HISTORY_EVENT,
  FORCE_RELEASE_REASON,
  IN_PRODUCTION_STATUS,
  PREPRESS_STATUS,
  PRODUCT_IN_PREPRESS,
  STAMP_PRODUCT_IN_PREPRESS_IN_STOCK,
  STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK,
} from '../fixtures/products'
import {
  DEDUCTION_PAST_IN_STOCK_MODEL,
  IN_STOCK_STAMP_MODEL,
  MANUAL_DEDUCTION_NOTE,
  OUT_OF_STOCK_STAMP_MODEL,
} from '../fixtures/stamps'
import { TEST_USERS } from '../fixtures/users'

// Driven against the database, no screen involved, like APR-REQ: a signed-in
// session calls what the app calls — or writes what it must not — and the
// outcome is read back through the runner's connection. The two release
// functions are the only way into production; the release gates in the app
// mirror them.

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

// ── The plain release's gates ─────────────────────────────────────────────

test.describe('in progress without a deadline, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-REL-003 releasing the product is refused', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — an incomplete product does not reach production.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

test.describe('in progress, stamp product in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('APR-REL-004 releasing the product is refused and books nothing', async ({ database, product }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('release_to_production', { product_id: product.id })

    // Assert — refused, still in pre-press, and no movement against the model.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
    expect(await database.stampStockMovements(OUT_OF_STOCK_STAMP_MODEL.id)).toEqual([])
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
    expect(await database.stampStockMovements(IN_STOCK_STAMP_MODEL.id)).toEqual([])
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
    expect(await database.stampStockMovements(IN_STOCK_STAMP_MODEL.id)).toEqual([])
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

// ── Booking on its own ────────────────────────────────────────────────────

test.describe('as employee', () => {
  test("APR-REL-011 booking deductions past the model's stock with the shortage allowed is refused", async ({ database }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — book straight through the deduction function, around any release.
    const { error } = await asEmployee.rpc('book_production_deductions', {
      deductions: DEDUCTION_PAST_IN_STOCK_MODEL,
      note: MANUAL_DEDUCTION_NOTE,
      allow_shortage: true,
    })

    // Assert — refused, and the model at its seed stock.
    expect(error).not.toBeNull()
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(IN_STOCK_STAMP_MODEL.stock)
  })
})
