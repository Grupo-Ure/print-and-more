/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * emails → **approvals**. Adds a customer approval request for the test's
 * product (`approvalRequest`), inserted as rows the way the request RPC
 * would have left them. It sits above `emails` because the specs that use it
 * drain the queue to see the mails a request causes.
 *
 * The fixture inserts a request; it never asks for one through the RPC and
 * never settles one. Asking, settling and withdrawing are what the specs are
 * about, so they are written inline in their Act stage.
 */
import { test as base } from './emails'
import { PENDING_MAILED_REQUEST, type ApprovalRequestSeed } from './approvalRequests'
import { TEST_USERS } from './users'
import type { TestApprovalRequest } from '../support/database'

type ApprovalFixtures = {
  /** What `approvalRequest` inserts; override per describe block with `test.use({ approvalRequestSeed })`. */
  approvalRequestSeed: ApprovalRequestSeed
  /**
   * A request for `product` over `orderFile`, asked by the employee, in the
   * state `approvalRequestSeed` describes. A pending one puts the product
   * into awaiting approval, as sending the request would have. Removed with
   * the order.
   */
  approvalRequest: TestApprovalRequest
  /**
   * Every mail still queued for `order` is archived after the test — the
   * request mail an Act stage asked for, or the notice a decision queued — so
   * nothing a test left waiting is claimed by the next test's drain. Automatic.
   */
  approvalMailQueue: void
}

export const test = base.extend<ApprovalFixtures>({
  approvalRequestSeed: [PENDING_MAILED_REQUEST, { option: true }],

  approvalRequest: async ({ database, product, orderFile, approvalRequestSeed }, use) => {
    await use(await database.createApprovalRequest(product, orderFile, approvalRequestSeed, TEST_USERS.employee))
  },

  approvalMailQueue: [
    async ({ database, order }, use) => {
      await use()
      await database.archiveQueuedEmails(order.id)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
