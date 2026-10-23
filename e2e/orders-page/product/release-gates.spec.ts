import { expect, test } from '../../fixtures/approvals'
import { IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../../fixtures/orders'
import {
  APPROVED_REQUEST,
  CHANGES_NOTE,
  CHANGES_REQUESTED_REQUEST,
  WITHDRAWN_REQUEST_STATUS,
} from '../../fixtures/approvalRequests'
import {
  POSTER_PRODUCT,
  PRODUCT_IN_PREPRESS,
  STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK,
  IN_PRODUCTION_STATUS,
  FORCE_RELEASE_REASON,
  FORCE_RELEASE_HISTORY_EVENT,
} from '../../fixtures/products'
import { TEST_USERS } from '../../fixtures/users'

// ── Completeness: what keeps a product in setup ───────────────────────────
// A product cannot lack content of its own, so the one requirement that can
// be unmet is the effective deadline.

test.describe('in progress, product with no deadline', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: POSTER_PRODUCT })

  test('PRD-GAT-001 the product is held in setup with the release blocked', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the banner names the block and the release cannot be pressed.
    await expect(ordersPage.details.productDetail.banner).toHaveAttribute('data-kind', 'blocked')
    await expect(ordersPage.details.productDetail.releaseButton).toBeDisabled()
  })
})

// ── Stock ─────────────────────────────────────────────────────────────────

test.describe('in progress, stamp product in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('PRD-GAT-004 the shortage is shown and the release to production is blocked', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the banner names the shortage and the release cannot be pressed.
    await expect(ordersPage.details.productDetail.banner).toHaveAttribute('data-kind', 'shortage')
    await expect(ordersPage.details.productDetail.releaseButton).toBeDisabled()
  })
})

// ── Force release (admin) ─────────────────────────────────────────────────

test.describe('as admin, in progress, product with no deadline', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: POSTER_PRODUCT })

  test('PRD-GAT-005 opening the force release prompt without a reason keeps it unsubmittable', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — open the force release from the release menu.
    await ordersPage.details.productDetail.releaseMenuTrigger.click()
    await ordersPage.details.productDetail.forceReleaseItem.click()

    // Assert — nothing can be submitted until a reason is given.
    await expect(ordersPage.details.productDetail.forceReleaseDialog.submit).toBeDisabled()
  })

  test('PRD-GAT-006 force releasing the product with a reason moves it to production flagged as missing information', async ({ ordersPage, product }) => {
    // Setup — the product's row in the list, with the product open.
    const row = ordersPage.details.productList.row(product.id)
    await ordersPage.openProduct(product)

    // Act — force release it with a reason.
    await ordersPage.details.productDetail.releaseMenuTrigger.click()
    await ordersPage.details.productDetail.forceReleaseItem.click()
    await ordersPage.details.productDetail.forceReleaseDialog.reason.fill(FORCE_RELEASE_REASON)
    await ordersPage.details.productDetail.forceReleaseDialog.submit.click()

    // Assert — the product is in production and carries the missing-information warning.
    await expect(row).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
    await expect(ordersPage.details.productList.rowMissingInfo(row)).toBeVisible()
  })

  test('PRD-GAT-007 force releasing the product records an emergency entry in the order history', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — force release it with a reason, then open the history.
    await ordersPage.details.productDetail.releaseMenuTrigger.click()
    await ordersPage.details.productDetail.forceReleaseItem.click()
    await ordersPage.details.productDetail.forceReleaseDialog.reason.fill(FORCE_RELEASE_REASON)
    await ordersPage.details.productDetail.forceReleaseDialog.submit.click()
    await ordersPage.details.historyTab.click()

    // Assert — the history holds the emergency entry.
    await expect(ordersPage.details.history.ofType(FORCE_RELEASE_HISTORY_EVENT)).toHaveCount(1)
  })
})

// ── Customer approval: the waiting product ────────────────────────────────
// The `approvalRequest` fixture's pending round put the product into awaiting
// approval, as sending the request would have.

test.describe('as admin, waiting product', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-GAT-008 the product offers neither a release nor a force release', async ({ ordersPage, product, approvalRequest: _waiting }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — nothing moves a waiting product on: no release, no release menu.
    await expect(ordersPage.details.productDetail.releaseButton).toHaveCount(0)
    await expect(ordersPage.details.productDetail.releaseMenuTrigger).toHaveCount(0)
  })
})

test.describe('waiting product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-GAT-009 the product offers no way to edit its spec', async ({ ordersPage, product, approvalRequest: _waiting }) => {
    // Setup — the product open on its Basic info tab.
    await ordersPage.openProduct(product)

    // Assert — the spec the customer is looking at cannot be edited.
    await expect(ordersPage.details.productDetail.basicInfo.edit).toHaveCount(0)
  })

  test("PRD-GAT-010 the product's settings are locked", async ({ ordersPage, product, approvalRequest: _waiting }) => {
    // Setup — the product open on its Settings tab.
    const settings = ordersPage.details.productDetail.settings
    await ordersPage.openProductSettings(product)

    // Assert — none of the request's settings can be given a value of its own.
    await expect(settings.separateDeadline).toBeDisabled()
    await expect(settings.separateDelivery).toBeDisabled()
    await expect(settings.separatePriority).toBeDisabled()
  })

  test('PRD-GAT-011 withdrawing the round offers the edit of the spec again', async ({ ordersPage, product, approvalRequest }) => {
    // Setup — the product's Files tab open, the pending round listed.
    const productDetail = ordersPage.details.productDetail
    const row = productDetail.files.requests.row(approvalRequest.id)
    await ordersPage.openProductFiles(product)

    // Act — take the round back, then return to the spec.
    await productDetail.files.requests.withdraw(row).click()
    await ordersPage.confirmDialog.confirm.click()
    await productDetail.basicInfoTab.click()

    // Assert — back in pre-press, the spec can be edited again.
    await expect(productDetail.basicInfo.edit).toBeVisible()
  })

  test('PRD-GAT-012 cancelling the product withdraws its open round', async ({ ordersPage, database, product, approvalRequest }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — cancel the product and confirm.
    await ordersPage.details.productDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the round was withdrawn rather than left open on a cancelled product.
    await expect.poll(async () => (await database.approvalRequestDecision(approvalRequest.id)).status).toBe(
      WITHDRAWN_REQUEST_STATUS,
    )
  })
})

// ── Customer approval: the newest round decides ───────────────────────────

test.describe('in progress, product in pre-press whose newest round came back with changes', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: CHANGES_REQUESTED_REQUEST })

  test('PRD-GAT-013 the release to production is blocked', async ({ ordersPage, product, approvalRequest: _changes }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the release cannot be pressed.
    await expect(ordersPage.details.productDetail.releaseButton).toBeDisabled()
  })

  test("PRD-GAT-014 the banner shows the customer's note", async ({ ordersPage, product, approvalRequest: _changes }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the banner quotes what the customer asked for.
    await expect(ordersPage.details.productDetail.bannerApprovalNote).toContainText(CHANGES_NOTE)
  })
})

test.describe('as admin, in progress, product in pre-press whose newest round came back with changes', () => {
  test.use({
    user: TEST_USERS.admin,
    orderSeed: IN_PROGRESS_ORDER,
    productSeed: PRODUCT_IN_PREPRESS,
    approvalRequestSeed: CHANGES_REQUESTED_REQUEST,
  })

  test('PRD-GAT-015 force releasing the product with a reason moves it to production', async ({ ordersPage, product, approvalRequest: _changes }) => {
    // Setup — the product open.
    const productDetail = ordersPage.details.productDetail
    await ordersPage.openProduct(product)

    // Act — force release it past the round with a reason.
    await productDetail.releaseMenuTrigger.click()
    await productDetail.forceReleaseItem.click()
    await productDetail.forceReleaseDialog.reason.fill(FORCE_RELEASE_REASON)
    await productDetail.forceReleaseDialog.submit.click()

    // Assert — the product is in production.
    await expect(productDetail.root).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })
})

test.describe('in progress, product in pre-press with an approved round', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: APPROVED_REQUEST })

  test('PRD-GAT-016 releasing the product to production moves it to in production', async ({ ordersPage, product, approvalRequest: _approved }) => {
    // Setup — the product open.
    const productDetail = ordersPage.details.productDetail
    await ordersPage.openProduct(product)

    // Act — release it and confirm.
    await productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is in production.
    await expect(productDetail.root).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })
})
