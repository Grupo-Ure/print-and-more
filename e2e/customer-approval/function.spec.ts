import { expect, test } from '../fixtures/approvals'
import {
  APPROVAL_MESSAGE,
  APPROVED_REQUEST_STATUS,
  ATTACHMENT_DISPOSITION,
  CHANGES_NOTE,
  CHANGES_REQUESTED_STATUS,
  FUNCTION_OK_STATUS,
  NOT_FOUND_STATUS,
  PENDING_REQUEST_STATUS,
  PROOF_CONTENT,
  UNKNOWN_TOKEN,
  WITHDRAWN_REQUEST,
  WITHDRAWN_REQUEST_STATUS,
} from '../fixtures/approvalRequests'
import { IN_PROGRESS_ORDER } from '../fixtures/orders'
import { PRODUCT_IN_PREPRESS } from '../fixtures/products'

// The customer's approval page's server half, called with `fetch` the way
// the page calls it: no session, the link's token as the only credential.
// `approvalRequest` is a round over the order's file with a token the test
// knows; `approvalProof` is that file's copy in the bucket. What a decision
// did is read back through the runner's connection.

// ── An open request ───────────────────────────────────────────────────────

test.describe('waiting product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-FN-001 reading the request by its token answers its message and files and leaves it pending', async ({
    database,
    customerApproval,
    approvalRequest,
    orderFile,
  }) => {
    // Act
    const { body } = await customerApproval.read(approvalRequest.token)

    // Assert — the message and the one file, and nothing decided by looking.
    expect(body?.message).toBe(APPROVAL_MESSAGE)
    expect(body?.files.map(file => file.id)).toEqual([orderFile.id])
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(PENDING_REQUEST_STATUS)
  })

  test('APR-FN-002 downloading the proof through the token streams the copy as an attachment', async ({
    customerApproval,
    approvalRequest,
    approvalProof,
  }) => {
    // Act
    const download = await customerApproval.download(approvalRequest.token, approvalProof.fileId)

    // Assert — the stored bytes, offered as a download.
    expect(download.content).toBe(PROOF_CONTENT)
    expect(download.disposition?.startsWith(ATTACHMENT_DISPOSITION)).toBe(true)
  })

  test('APR-FN-003 posting an approval settles the request as approved', async ({ database, customerApproval, approvalRequest }) => {
    // Act
    await customerApproval.decide(approvalRequest.token, APPROVED_REQUEST_STATUS, null)

    // Assert
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(APPROVED_REQUEST_STATUS)
  })

  test('APR-FN-004 posting a request for changes with a note records the note on the request', async ({
    database,
    customerApproval,
    approvalRequest,
  }) => {
    // Act
    await customerApproval.decide(approvalRequest.token, CHANGES_REQUESTED_STATUS, CHANGES_NOTE)

    // Assert
    expect(await database.approvalRequestDecision(approvalRequest.id)).toEqual({
      status: CHANGES_REQUESTED_STATUS,
      note: CHANGES_NOTE,
    })
  })

  test('APR-FN-005 posting a second decision leaves the first one standing', async ({ database, customerApproval, approvalRequest }) => {
    // Setup — the customer has approved.
    await customerApproval.decide(approvalRequest.token, APPROVED_REQUEST_STATUS, null)

    // Act — the page is opened again and changes are asked for.
    const second = await customerApproval.decide(approvalRequest.token, CHANGES_REQUESTED_STATUS, CHANGES_NOTE)

    // Assert — answered with the outcome, not an error, and the approval stands.
    expect(second.status).toBe(FUNCTION_OK_STATUS)
    expect((await database.approvalRequestDecision(approvalRequest.id)).status).toBe(APPROVED_REQUEST_STATUS)
  })
})

// ── A closed request ──────────────────────────────────────────────────────

test.describe('withdrawn request', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: WITHDRAWN_REQUEST })

  test('APR-FN-006 reading the request by its token answers withdrawn with no file', async ({ customerApproval, approvalRequest }) => {
    // Act
    const { body } = await customerApproval.read(approvalRequest.token)

    // Assert
    expect(body?.status).toBe(WITHDRAWN_REQUEST_STATUS)
    expect(body?.files).toHaveLength(0)
  })

  test('APR-FN-007 downloading the proof through the token answers not found', async ({ customerApproval, approvalRequest, approvalProof }) => {
    // Act
    const download = await customerApproval.download(approvalRequest.token, approvalProof.fileId)

    // Assert
    expect(download.status).toBe(NOT_FOUND_STATUS)
  })
})

// ── Any caller ────────────────────────────────────────────────────────────

test('APR-FN-008 reading a request by an unknown token answers not found', async ({ customerApproval }) => {
  // Act
  const { status } = await customerApproval.read(UNKNOWN_TOKEN)

  // Assert
  expect(status).toBe(NOT_FOUND_STATUS)
})
