import { expect, test } from '../fixtures/approvals'
import { APPROVED_REQUEST, NOT_FOUND_STATUS } from '../fixtures/approvalRequests'
import { BILLED_PAST_RETENTION_ORDER, BILLED_WITHIN_RETENTION_ORDER, FINISHED_ORDER } from '../fixtures/orders'
import { PRODUCT_DONE } from '../fixtures/products'

// The daily proof purge, called on demand through the runner's connection the
// way the cron job calls it; the outcome is read back the same way. A run
// purges every due copy in the database, so only seeds meant for it are
// billed. The run stamps the file rows at once; the bucket deletes go out
// after it commits, so the bucket is polled. The retention is the setting's
// shipped default, which the billed seeds are dated against.

// ── Past the retention ────────────────────────────────────────────────────

test.describe('order billed longer ago than the retention, approved round', () => {
  test.use({ orderSeed: BILLED_PAST_RETENTION_ORDER, productSeed: PRODUCT_DONE, approvalRequestSeed: APPROVED_REQUEST })

  test("APR-CLN-001 running the purge removes the proof's copy from the bucket", async ({
    database,
    approvalRequest,
    approvalProof: _stored,
  }) => {
    // Act
    await database.purgeApprovalFiles()

    // Assert
    await expect.poll(() => database.approvalProofStored(approvalRequest.storagePath)).toBe(false)
  })

  test("APR-CLN-002 running the purge marks the round's file as purged", async ({ database, approvalRequest }) => {
    // Act
    await database.purgeApprovalFiles()

    // Assert
    expect(await database.approvalRequestFilePurgedAt(approvalRequest.id, approvalRequest.fileId)).not.toBeNull()
  })

  test('APR-CLN-003 downloading the proof through the token after the purge answers not found', async ({
    database,
    customerApproval,
    approvalRequest,
    approvalProof,
  }) => {
    // Setup — the copy was served until the run.
    await database.purgeApprovalFiles()

    // Act
    const { status } = await customerApproval.download(approvalRequest.token, approvalProof.fileId)

    // Assert
    expect(status).toBe(NOT_FOUND_STATUS)
  })
})

// ── Not yet due ───────────────────────────────────────────────────────────

test.describe('order billed within the retention, approved round', () => {
  test.use({ orderSeed: BILLED_WITHIN_RETENTION_ORDER, productSeed: PRODUCT_DONE, approvalRequestSeed: APPROVED_REQUEST })

  test("APR-CLN-004 running the purge leaves the round's file unpurged", async ({ database, approvalRequest }) => {
    // Act
    await database.purgeApprovalFiles()

    // Assert
    expect(await database.approvalRequestFilePurgedAt(approvalRequest.id, approvalRequest.fileId)).toBeNull()
  })
})

test.describe('finished, unbilled order, approved round', () => {
  test.use({ orderSeed: FINISHED_ORDER, productSeed: PRODUCT_DONE, approvalRequestSeed: APPROVED_REQUEST })

  test("APR-CLN-005 running the purge leaves the round's file unpurged", async ({ database, approvalRequest }) => {
    // Act
    await database.purgeApprovalFiles()

    // Assert
    expect(await database.approvalRequestFilePurgedAt(approvalRequest.id, approvalRequest.fileId)).toBeNull()
  })
})
