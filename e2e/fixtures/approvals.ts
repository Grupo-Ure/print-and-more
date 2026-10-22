/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * emails → **approvals**. Adds a customer approval request for the test's
 * product (`approvalRequest`), inserted as rows the way the request RPC
 * would have left them, the stored copy of its proof (`approvalProof`), and
 * the runner's handle on the customer's page's function
 * (`customerApproval`). It sits above `emails` because the specs that use it
 * drain the queue to see the mails a request causes.
 *
 * The fixture inserts a request; it never asks for one through the RPC and
 * never settles one. Asking, settling and withdrawing are what the specs are
 * about, so they are written inline in their Act stage.
 */
import { test as base } from './emails'
import { PENDING_MAILED_REQUEST, PROOF_CONTENT, type ApprovalRequestSeed } from './approvalRequests'
import { TEST_USERS } from './users'
import { CustomerApprovalFunction } from '../support/customerApproval'
import type { TestApprovalRequest } from '../support/database'

/** What a spec gets to know about the proof copy the fixture stored for it. */
export type ApprovalProof = {
  /** The file the copy is of — what the page's download link names. */
  fileId: string
}

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
   * The copy of `approvalRequest`'s proof in the approval-proofs bucket, at
   * the path its file row names, as the app uploads it before asking. Holds
   * `PROOF_CONTENT`. Removed from the bucket after the test — the order's
   * cascade does not reach storage.
   */
  approvalProof: ApprovalProof
  /** The `customer-approval` edge function, called the way the customer's page calls it. */
  customerApproval: CustomerApprovalFunction
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

  approvalProof: async ({ database, approvalRequest }, use) => {
    await database.storeApprovalProof(approvalRequest.storagePath, PROOF_CONTENT)

    await use({ fileId: approvalRequest.fileId })
    await database.removeApprovalProofs([approvalRequest.storagePath])
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
  customerApproval: async ({}, use) => {
    await use(new CustomerApprovalFunction())
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
