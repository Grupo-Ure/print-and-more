/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * emails → **approvals**. Adds a customer approval request for the test's
 * product (`approvalRequest`), inserted as rows the way the request RPC
 * would have left them, the stored copy of its proof (`approvalProof`), the
 * product's proofs as real files on disk (`proofFiles`) with a round over
 * one of them (`proofRound`) for the Files tab, and
 * the runner's handle on the customer's page's function
 * (`customerApproval`). It sits above `emails` because the specs that use it
 * drain the queue to see the mails a request causes.
 *
 * The fixture inserts a request; it never asks for one through the RPC and
 * never settles one. Asking, settling and withdrawing are what the specs are
 * about, so they are written inline in their Act stage.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from './emails'
import { PENDING_MAILED_REQUEST, PROOF_CONTENT, type ApprovalRequestSeed } from './approvalRequests'
import { PROOF_FILES } from './files'
import { reloadApp } from './orders'
import { TEST_USERS } from './users'
import { CustomerApprovalFunction } from '../support/customerApproval'
import type { TestApprovalRequest, TestFile } from '../support/database'

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
  /**
   * The `PROOF_FILES`, written to a fresh temporary folder on disk — real
   * files, which the desktop app reads when it asks for an approval — and
   * linked to `order` and attached to `product`. Afterwards the folder is
   * deleted and every proof copy the app stored for the order is removed from
   * the bucket; the file rows go with the order.
   */
  proofFiles: TestFile[]
  /** What `proofRound` inserts; override per describe block with `test.use({ proofRoundSeed })`. */
  proofRoundSeed: ApprovalRequestSeed
  /**
   * A round for `product` over the first of the `proofFiles`, asked by the
   * employee, in the state `proofRoundSeed` describes — the product's own
   * file, so the Files tab can ask again once it is closed. A pending one
   * puts the product into awaiting approval. Removed with the order.
   */
  proofRound: TestApprovalRequest
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

  proofFiles: async ({ page, navbar, database, order, product }, use) => {
    const folder = await mkdtemp(join(tmpdir(), 'pam-e2e-proofs-'))
    const files: TestFile[] = []
    for (const { content, ...seed } of PROOF_FILES) {
      const path = join(folder, seed.display_name)
      await writeFile(path, content)
      const file = await database.createFile(order.id, { ...seed, path })
      await database.attachFileToProduct(product.id, file.id)
      files.push(file)
    }
    await reloadApp(page, navbar)

    await use(files)
    await database.removeApprovalProofsOfOrder(order.id)
    await rm(folder, { recursive: true, force: true })
  },

  proofRoundSeed: [PENDING_MAILED_REQUEST, { option: true }],

  proofRound: async ({ page, navbar, database, product, proofFiles, proofRoundSeed }, use) => {
    const round = await database.createApprovalRequest(product, proofFiles[0], proofRoundSeed, TEST_USERS.employee)
    // The round may have moved the product; let the app read it afresh.
    await reloadApp(page, navbar)

    await use(round)
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
