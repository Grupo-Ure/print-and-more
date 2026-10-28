import { expect, test } from '../../fixtures/approvals'
import { IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../../fixtures/orders'
import {
  APPROVAL_REQUESTED_HISTORY_EVENT,
  APPROVED_REQUEST_STATUS,
  EXPIRED_REQUEST,
  FIRST_ROUND,
  PENDING_REQUEST_STATUS,
  WITHDRAWN_REQUEST,
  WITHDRAWN_REQUEST_STATUS,
} from '../../fixtures/approvalRequests'
import { APPROVAL_REQUEST_TEMPLATE } from '../../fixtures/emailMessages'
import {
  AWAITING_APPROVAL_STATUS,
  IN_PRODUCTION_STATUS,
  OTHER_PRODUCT,
  PREPRESS_STATUS,
  PRODUCT_IN_PREPRESS,
  STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK,
} from '../../fixtures/products'
import { OUT_OF_STOCK_STAMP_MODEL } from '../../fixtures/stamps'
import { TEST_USERS } from '../../fixtures/users'

// ── Asking ────────────────────────────────────────────────────────────────

test.describe('in progress, product in pre-press with two files', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-APR-001 ticking one file and requesting approval lists round one as pending with that file', async ({ ordersPage, product, proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    const [, backProof] = proofFiles
    await ordersPage.openProductFiles(product)

    // Act — tick the second proof and send the request for it.
    await files.itemSelect(files.item(backProof.id)).click()
    await files.requestApproval.click()
    await files.requestDialog.submit.click()

    // Assert — round one is listed as pending, and its details name that proof.
    await expect(files.requests.round(FIRST_ROUND)).toHaveAttribute('data-status', PENDING_REQUEST_STATUS)
    await files.requests.round(FIRST_ROUND).click()
    await expect(files.requests.file(backProof.id)).toBeVisible()
  })

  test('PRD-APR-002 requesting approval moves the product to awaiting approval', async ({ ordersPage, product, proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    const [frontProof] = proofFiles
    await ordersPage.openProductFiles(product)

    // Act — send the request for one proof.
    await files.itemSelect(files.item(frontProof.id)).click()
    await files.requestApproval.click()
    await files.requestDialog.submit.click()

    // Assert — the product waits for the customer.
    await expect(ordersPage.details.productDetail.root).toHaveAttribute('data-status', AWAITING_APPROVAL_STATUS)
  })

  test('PRD-APR-003 unticking every file in the request dialog keeps it unsubmittable', async ({ ordersPage, product, proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    const [frontProof, backProof] = proofFiles
    await ordersPage.openProductFiles(product)

    // Act — open the request with nothing ticked (every file is offered) and untick both.
    await files.requestApproval.click()
    await files.requestDialog.fileCheckbox(frontProof.id).click()
    await files.requestDialog.fileCheckbox(backProof.id).click()

    // Assert — nothing can be sent.
    await expect(files.requestDialog.submit).toBeDisabled()
  })

  test('PRD-APR-004 requesting approval records the request in the order history', async ({ ordersPage, product, proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    const [frontProof] = proofFiles
    await ordersPage.openProductFiles(product)

    // Act — send the request for one proof, then open the history.
    await files.itemSelect(files.item(frontProof.id)).click()
    await files.requestApproval.click()
    await files.requestDialog.submit.click()
    await files.requestDialog.root.waitFor({ state: 'hidden' })
    await ordersPage.details.historyTab.click()

    // Assert — the history holds the request.
    await expect(ordersPage.details.history.ofType(APPROVAL_REQUESTED_HISTORY_EVENT)).toHaveCount(1)
  })

  test("PRD-APR-005 requesting approval lists its mail on the order's emails tab", async ({ ordersPage, product, proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    const [frontProof] = proofFiles
    await ordersPage.openProductFiles(product)

    // Act — send the request for one proof, then open the order's mails.
    await files.itemSelect(files.item(frontProof.id)).click()
    await files.requestApproval.click()
    await files.requestDialog.submit.click()
    await files.requestDialog.root.waitFor({ state: 'hidden' })
    await ordersPage.details.emailsTab.click()

    // Assert — the request mail is listed, waiting or sent.
    await expect(ordersPage.details.emails.ofTemplate(APPROVAL_REQUEST_TEMPLATE)).toHaveCount(1)
  })
})

// ── Answering by hand, withdrawing ────────────────────────────────────────

test.describe('in progress, product with two files awaiting approval', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-APR-007 approving the round by hand lists it as approved by the user', async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the pending round listed.
    const files = ordersPage.details.productDetail.files
    const row = files.requests.row(proofRound.id)
    await ordersPage.openProductFiles(product)

    // Act — record the customer's approval.
    await files.requests.approve(row).click()
    await files.answerDialog.submit.click()

    // Assert — the round is approved, and its details name the signed-in employee as who recorded it.
    await expect(row).toHaveAttribute('data-status', APPROVED_REQUEST_STATUS)
    await row.click()
    await expect(files.requests.settledBy).toHaveAttribute('data-user-name', TEST_USERS.employee.name)
  })

  test('PRD-APR-008 approving the round by hand moves the product into production', async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the pending round listed.
    const files = ordersPage.details.productDetail.files
    const row = files.requests.row(proofRound.id)
    await ordersPage.openProductFiles(product)

    // Act — record the customer's approval.
    await files.requests.approve(row).click()
    await files.answerDialog.submit.click()

    // Assert — the product is in production.
    await expect(ordersPage.details.productDetail.root).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })

  test('PRD-APR-009 withdrawing the round lists it as withdrawn', async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the pending round listed.
    const files = ordersPage.details.productDetail.files
    const row = files.requests.row(proofRound.id)
    await ordersPage.openProductFiles(product)

    // Act — take the round back.
    await files.requests.withdraw(row).click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the round is listed as withdrawn.
    await expect(row).toHaveAttribute('data-status', WITHDRAWN_REQUEST_STATUS)
  })

  test('PRD-APR-010 withdrawing the round offers the approval request again', async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the pending round listed.
    const files = ordersPage.details.productDetail.files
    const row = files.requests.row(proofRound.id)
    await ordersPage.openProductFiles(product)

    // Act — take the round back.
    await files.requests.withdraw(row).click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — a new round can be asked for.
    await expect(files.requestApproval).toBeEnabled()
  })
})

// ── Stock ─────────────────────────────────────────────────────────────────

test.describe('in progress, stamp product in pre-press with two files, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('PRD-APR-011 opening the approval request names the short model', async ({ ordersPage, product, proofFiles: _proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    await ordersPage.openProductFiles(product)

    // Act — open the request.
    await files.requestApproval.click()

    // Assert — the dialog names the model the product is short of.
    await expect(files.requestDialog.shortage(OUT_OF_STOCK_STAMP_MODEL.id)).toBeVisible()
  })

  test('PRD-APR-012 cancelling the warned request leaves the product in pre-press with no round', async ({ ordersPage, product, proofFiles: _proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    await ordersPage.openProductFiles(product)

    // Act — open the request, see the warning, and cancel.
    await files.requestApproval.click()
    await files.requestDialog.shortages.waitFor()
    await files.requestDialog.cancel.click()

    // Assert — the product is still in pre-press and has no round.
    await expect(ordersPage.details.productDetail.root).toHaveAttribute('data-status', PREPRESS_STATUS)
    await expect(files.requests.empty).toBeVisible()
  })

  test('PRD-APR-013 sending the request anyway lists round one as pending', async ({ ordersPage, product, proofFiles: _proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    const files = ordersPage.details.productDetail.files
    await ordersPage.openProductFiles(product)

    // Act — open the request, see the warning, and send anyway.
    await files.requestApproval.click()
    await files.requestDialog.shortages.waitFor()
    await files.requestDialog.submit.click()

    // Assert — round one is listed as pending.
    await expect(files.requests.round(FIRST_ROUND)).toHaveAttribute('data-status', PENDING_REQUEST_STATUS)
  })
})

// ── The next round ────────────────────────────────────────────────────────

test.describe('in progress, product in pre-press with two files, previous round withdrawn', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, proofRoundSeed: WITHDRAWN_REQUEST })

  test("PRD-APR-014 opening the approval request preselects the previous round's file", async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the withdrawn round listed.
    const files = ordersPage.details.productDetail.files
    await ordersPage.openProductFiles(product)
    await files.requests.row(proofRound.id).waitFor()

    // Act — open the request.
    await files.requestApproval.click()

    // Assert — exactly the previous round's proof is ticked.
    await expect.poll(() => files.requestDialog.checkedFileIds()).toEqual([proofRound.fileId])
  })
})

test.describe('in progress, product in pre-press with two files, previous round expired', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, proofRoundSeed: EXPIRED_REQUEST })

  test('PRD-APR-016 the approval request is enabled', async ({ ordersPage, product, proofRound }) => {
    // Setup — the product's Files tab open, the expired round listed.
    const files = ordersPage.details.productDetail.files
    await ordersPage.openProductFiles(product)
    await files.requests.row(proofRound.id).waitFor()

    // Assert — a new round can be asked for.
    await expect(files.requestApproval).toBeEnabled()
  })
})

// ── Before pre-press ──────────────────────────────────────────────────────

test.describe('in progress without a deadline, product in setup with two files', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: OTHER_PRODUCT })

  test('PRD-APR-015 the approval request is disabled', async ({ ordersPage, product, proofFiles: _proofFiles }) => {
    // Setup — the product's Files tab open on its own files.
    await ordersPage.openProductFiles(product)

    // Assert — no request can be sent from setup.
    await expect(ordersPage.details.productDetail.files.requestApproval).toBeDisabled()
  })
})
