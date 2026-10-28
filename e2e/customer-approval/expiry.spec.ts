import { expect, test } from '../fixtures/approvals'
import {
  CHANGES_REQUESTED_STATUS,
  EXPIRED_REQUEST,
  EXPIRED_REQUEST_STATUS,
  OVERDUE_CHANGES_REQUESTED_REQUEST,
  OVERDUE_REQUEST,
  PENDING_REQUEST_STATUS,
} from '../fixtures/approvalRequests'
import { shopInbox } from '../fixtures/emailMessages'
import { IN_PROGRESS_ORDER } from '../fixtures/orders'
import { PREPRESS_STATUS, PRODUCT_IN_PREPRESS } from '../fixtures/products'

// The daily expiry run, called on demand through the runner's connection the
// way the cron job calls it; the outcome is read back the same way. A run
// closes every overdue pending request in the database, so a seed is overdue
// only where a test means it to be. The sender runs with EMAIL_DRY_RUN=true,
// so a drain records the mail without one leaving.

// ── Running the expiry ────────────────────────────────────────────────────

test.describe('waiting product, request past its expiry', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: OVERDUE_REQUEST })

  test('APR-EXP-001 running the expiry closes the request as expired', async ({ database, approvalRequest }) => {
    // Act
    await database.expireApprovalRequests()

    // Assert
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(EXPIRED_REQUEST_STATUS)
  })

  test('APR-EXP-002 running the expiry returns the product to pre-press', async ({ database, product, approvalRequest: _overdue }) => {
    // Act
    await database.expireApprovalRequests()

    // Assert
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })

  test("APR-EXP-003 draining the queue after the expiry sends the expired mail to the shop's inbox", async ({
    database,
    sendEmail,
    order,
    approvalRequest: _overdue,
  }) => {
    // Act — the run, then one drain.
    await database.expireApprovalRequests()
    await sendEmail.drain()

    // Assert — one mail went out, to the shop.
    expect((await database.sentEmails(order.id)).map(sent => sent.recipient)).toEqual([shopInbox()])
  })
})

test.describe('waiting product, request not yet due', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-EXP-004 running the expiry leaves the request pending', async ({ database, approvalRequest }) => {
    // Act
    await database.expireApprovalRequests()

    // Assert
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(PENDING_REQUEST_STATUS)
  })
})

test.describe('round that came back with changes, past its expiry', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: OVERDUE_CHANGES_REQUESTED_REQUEST })

  test("APR-EXP-005 running the expiry leaves the round's decision standing", async ({ database, approvalRequest }) => {
    // Act
    await database.expireApprovalRequests()

    // Assert
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(CHANGES_REQUESTED_STATUS)
  })
})

// ── The link afterwards ───────────────────────────────────────────────────

test.describe('expired request', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: EXPIRED_REQUEST })

  test('APR-EXP-006 reading the request by its token answers expired with no file', async ({ customerApproval, approvalRequest }) => {
    // Act
    const { body } = await customerApproval.read(approvalRequest.token)

    // Assert
    expect(body?.status).toBe(EXPIRED_REQUEST_STATUS)
    expect(body?.files).toHaveLength(0)
  })
})
