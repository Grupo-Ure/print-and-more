import {
  expect,
  test,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_ORDER_WITHOUT_DEADLINE,
} from '../../fixtures/orders'
import {
  POSTER_PRODUCT,
  PRODUCT_IN_PREPRESS_AWAITING_APPROVAL,
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

  test('the product is held in setup with the release blocked', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the banner names the block and the release cannot be pressed.
    await expect(ordersPage.details.productDetail.banner).toHaveAttribute('data-kind', 'blocked')
    await expect(ordersPage.details.productDetail.releaseButton).toBeDisabled()
  })
})

// ── Customer approval ─────────────────────────────────────────────────────

test.describe('in progress, product in pre-press awaiting customer approval', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS_AWAITING_APPROVAL })

  test('the release to production is blocked', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — the release cannot be pressed.
    await expect(ordersPage.details.productDetail.releaseButton).toBeDisabled()
  })

  test('granting the approval against a file unblocks the release to production', async ({ ordersPage, product, orderFile }) => {
    // Setup — the product open on its Settings tab.
    const settings = ordersPage.details.productDetail.settings
    await ordersPage.openProductSettings(product)

    // Act — grant the approval against the linked file.
    await settings.grantApproval.click()
    await settings.grantDialog.file(orderFile.id).click()
    await settings.grantDialog.submit.click()
    await settings.approvalGranted.waitFor()

    // Assert — the release can be pressed.
    await expect(ordersPage.details.productDetail.releaseButton).toBeEnabled()
  })
})

// ── Stock ─────────────────────────────────────────────────────────────────

test.describe('in progress, stamp product in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('the shortage is shown and the release to production is blocked', async ({ ordersPage, product }) => {
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

  test('opening the force release prompt without a reason keeps it unsubmittable', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — open the force release from the release menu.
    await ordersPage.details.productDetail.releaseMenuTrigger.click()
    await ordersPage.details.productDetail.forceReleaseItem.click()

    // Assert — nothing can be submitted until a reason is given.
    await expect(ordersPage.details.productDetail.forceReleaseDialog.submit).toBeDisabled()
  })

  test('force releasing the product with a reason moves it to production flagged as missing information', async ({ ordersPage, product }) => {
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

  test('force releasing the product records an emergency entry in the order history', async ({ ordersPage, product }) => {
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
