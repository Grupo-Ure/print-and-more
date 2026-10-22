import { expect, test } from '../fixtures/approvals'
import {
  APPROVAL_GRANTED_HISTORY_EVENT,
  APPROVAL_MESSAGE,
  APPROVED_REQUEST_STATUS,
  CHANGES_NOTE,
  CHANGES_REQUESTED_HISTORY_EVENT,
  CHANGES_REQUESTED_STATUS,
  FIRST_ROUND,
  hashToken,
  newRequestId,
  PENDING_REQUEST_STATUS,
  PENDING_UNMAILED_REQUEST,
  releaseMovementNote,
  storagePathFor,
  tokenFromMail,
  WITHDRAWN_REQUEST,
} from '../fixtures/approvalRequests'
import { APPROVAL_REQUEST_TEMPLATE, APPROVAL_WITHDRAWN_TEMPLATE } from '../fixtures/emailMessages'
import { IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE, missedOrderDeadline } from '../fixtures/orders'
import {
  AWAITING_APPROVAL_STATUS,
  IN_PRODUCTION_STATUS,
  OTHER_PRODUCT,
  PREPRESS_STATUS,
  PRODUCT_IN_PREPRESS,
  STAMP_PRODUCT_IN_PREPRESS_IN_STOCK,
  STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK,
} from '../fixtures/products'
import { IN_STOCK_STAMP_MODEL, OUT_OF_STOCK_STAMP_MODEL } from '../fixtures/stamps'
import { TEST_USERS } from '../fixtures/users'

// Driven against the database, no screen involved: a signed-in session calls
// the RPCs the app will call, and the outcome is read back through the
// runner's connection. The sender runs with EMAIL_DRY_RUN=true, so a drain
// records the mail without one leaving.

// ── Asking ────────────────────────────────────────────────────────────────

test.describe('in progress, product in pre-press with a file', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-REQ-001 creating a request records round one as pending with its file', async ({ database, order, product, orderFile }) => {
    // Setup — a connection that writes as the employee, and the id the app would mint.
    const asEmployee = await database.asUser(TEST_USERS.employee)
    const requestId = newRequestId()

    // Act
    await asEmployee.rpc('create_approval_request', {
      request_id: requestId,
      product_id: product.id,
      file_ids: [orderFile.id],
      storage_paths: [storagePathFor(order.id, requestId, orderFile)],
      message: APPROVAL_MESSAGE,
      mailed: true,
    })

    // Assert — one round, pending, over that file.
    expect((await database.approvalRequests(product.id)).map(request => [request.round, request.status])).toEqual([
      [FIRST_ROUND, PENDING_REQUEST_STATUS],
    ])
    expect(await database.approvalRequestFileIds(requestId)).toEqual([orderFile.id])
  })

  test('APR-REQ-002 creating a request moves the product to awaiting approval', async ({ database, order, product, orderFile }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)
    const requestId = newRequestId()

    // Act
    await asEmployee.rpc('create_approval_request', {
      request_id: requestId,
      product_id: product.id,
      file_ids: [orderFile.id],
      storage_paths: [storagePathFor(order.id, requestId, orderFile)],
      message: APPROVAL_MESSAGE,
      mailed: true,
    })

    // Assert
    expect((await database.productState(product.id)).status).toBe(AWAITING_APPROVAL_STATUS)
  })

  test('APR-REQ-003 creating a request queues the request mail for the order', async ({ database, order, product, orderFile }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)
    const requestId = newRequestId()

    // Act
    await asEmployee.rpc('create_approval_request', {
      request_id: requestId,
      product_id: product.id,
      file_ids: [orderFile.id],
      storage_paths: [storagePathFor(order.id, requestId, orderFile)],
      message: APPROVAL_MESSAGE,
      mailed: true,
    })

    // Assert — exactly the request mail waits for the order.
    expect((await database.queuedEmails(order.id)).map(queued => queued.template)).toEqual([APPROVAL_REQUEST_TEMPLATE])
  })

  test('APR-REQ-004 draining the queue after a request sends a mail whose link token finds the request by its hash', async ({
    database,
    sendEmail,
    order,
    product,
    orderFile,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)
    const requestId = newRequestId()

    // Act — ask, then one drain, as the cron would make it.
    await asEmployee.rpc('create_approval_request', {
      request_id: requestId,
      product_id: product.id,
      file_ids: [orderFile.id],
      storage_paths: [storagePathFor(order.id, requestId, orderFile)],
      message: APPROVAL_MESSAGE,
      mailed: true,
    })
    await sendEmail.drain()
    const [bodyHtml] = await database.sentEmailBodies(order.id)
    const token = tokenFromMail(bodyHtml ?? '') ?? ''

    // Assert — the token in the sent link hashes to the request's stored hash.
    expect(await database.approvalRequestIdByTokenHash(hashToken(token))).toBe(requestId)
  })

  test('APR-REQ-005 setting the product to awaiting approval directly is refused', async ({ database, product }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — move the status by hand, with no request behind it.
    const { error } = await asEmployee.from('products').update({ status: AWAITING_APPROVAL_STATUS }).eq('id', product.id)

    // Assert — refused, and the product still in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

test.describe('in progress, product in setup with a file', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: OTHER_PRODUCT })

  test('APR-REQ-006 creating a request is refused', async ({ database, order, product, orderFile }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)
    const requestId = newRequestId()

    // Act
    const { error } = await asEmployee.rpc('create_approval_request', {
      request_id: requestId,
      product_id: product.id,
      file_ids: [orderFile.id],
      storage_paths: [storagePathFor(order.id, requestId, orderFile)],
      message: APPROVAL_MESSAGE,
      mailed: true,
    })

    // Assert — refused, and no round recorded.
    expect(error).not.toBeNull()
    expect(await database.approvalRequests(product.id)).toHaveLength(0)
  })
})

// ── The waiting product ───────────────────────────────────────────────────

test.describe('waiting product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('APR-REQ-007 approving the request by hand moves the product into production', async ({ database, product, approvalRequest }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('settle_approval_request', { request_id: approvalRequest.id, decision: APPROVED_REQUEST_STATUS })

    // Assert
    expect((await database.productState(product.id)).status).toBe(IN_PRODUCTION_STATUS)
  })

  test('APR-REQ-008 approving the request by hand sends the decided mail to the assignee', async ({
    database,
    sendEmail,
    order,
    product,
    approvalRequest,
  }) => {
    // Setup — the product is the employee's.
    const asEmployee = await database.asUser(TEST_USERS.employee)
    await database.assignProduct(product.id, TEST_USERS.employee)

    // Act — decide, then one drain.
    await asEmployee.rpc('settle_approval_request', { request_id: approvalRequest.id, decision: APPROVED_REQUEST_STATUS })
    await sendEmail.drain()

    // Assert — one mail went out, to the assignee.
    expect((await database.sentEmails(order.id)).map(sent => sent.recipient)).toEqual([TEST_USERS.employee.email])
  })

  test('APR-REQ-009 requesting changes by hand returns the product to pre-press with the note in the history entry', async ({
    database,
    order,
    product,
    approvalRequest,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('settle_approval_request', {
      request_id: approvalRequest.id,
      decision: CHANGES_REQUESTED_STATUS,
      note: CHANGES_NOTE,
    })

    // Assert — back in pre-press, and the entry carries the note.
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
    expect((await database.historyEntries(order.id, CHANGES_REQUESTED_HISTORY_EVENT)).map(entry => entry.meta)).toEqual([
      expect.objectContaining({ note: CHANGES_NOTE }),
    ])
  })

  test('APR-REQ-010 withdrawing the request returns the product to pre-press and queues the withdrawn mail', async ({
    database,
    order,
    product,
    approvalRequest,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('withdraw_approval_request', { request_id: approvalRequest.id })

    // Assert
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
    expect((await database.queuedEmails(order.id)).map(queued => queued.template)).toEqual([APPROVAL_WITHDRAWN_TEMPLATE])
  })

  test('APR-REQ-011 moving the product to another status directly is refused', async ({ database, product, approvalRequest: _waiting }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — release by hand, around the request.
    const { error } = await asEmployee.from('products').update({ status: IN_PRODUCTION_STATUS }).eq('id', product.id)

    // Assert — refused, and the product still waiting.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(AWAITING_APPROVAL_STATUS)
  })

  test('APR-REQ-012 changing the quantity of the product directly is refused', async ({ database, product, approvalRequest: _waiting }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — change a spec column on the parent row.
    const { error } = await asEmployee
      .from('products')
      .update({ quantity: (OTHER_PRODUCT.quantity ?? 0) + 1 })
      .eq('id', product.id)

    // Assert — refused, and the quantity as seeded.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).quantity).toBe(OTHER_PRODUCT.quantity)
  })

  test('APR-REQ-013 changing the deadline of the product directly is refused', async ({ database, product, approvalRequest: _waiting }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — give the product a deadline of its own.
    const { error } = await asEmployee.from('products').update({ deadline: missedOrderDeadline() }).eq('id', product.id)

    // Assert — refused, and the product still inheriting the order's.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).deadline).toBeNull()
  })
})

// ── Stock on approval ─────────────────────────────────────────────────────

test.describe('waiting stamp product, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test('APR-REQ-014 approving the request by hand books the model stock with a movement naming the order', async ({
    database,
    order,
    approvalRequest,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('settle_approval_request', { request_id: approvalRequest.id, decision: APPROVED_REQUEST_STATUS })

    // Assert — the product's quantity left the model, in one movement that names the order.
    expect(await database.stampModelStock(IN_STOCK_STAMP_MODEL.id)).toBe(
      IN_STOCK_STAMP_MODEL.stock - (STAMP_PRODUCT_IN_PREPRESS_IN_STOCK.quantity ?? 0),
    )
    expect(await database.stampStockMovements(IN_STOCK_STAMP_MODEL.id)).toEqual([
      { quantity: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK.quantity, note: releaseMovementNote(order.orderNumber) },
    ])
  })
})

test.describe('waiting stamp product, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK })

  test('APR-REQ-015 approving the request by hand books the shortfall at zero and names it in the history entry', async ({
    database,
    order,
    approvalRequest,
  }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('settle_approval_request', { request_id: approvalRequest.id, decision: APPROVED_REQUEST_STATUS })

    // Assert — nothing could leave the model, and the entry names it short.
    expect(await database.stampModelStock(OUT_OF_STOCK_STAMP_MODEL.id)).toBe(OUT_OF_STOCK_STAMP_MODEL.stock)
    expect((await database.historyEntries(order.id, APPROVAL_GRANTED_HISTORY_EVENT)).map(entry => entry.meta)).toEqual([
      expect.objectContaining({ shortages: [expect.objectContaining({ id: OUT_OF_STOCK_STAMP_MODEL.id, available: 0 })] }),
    ])
  })
})

// ── Closed requests ───────────────────────────────────────────────────────

test.describe('withdrawn request', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: WITHDRAWN_REQUEST })

  test('APR-REQ-016 settling the request is refused', async ({ database, product, approvalRequest }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    const { error } = await asEmployee.rpc('settle_approval_request', {
      request_id: approvalRequest.id,
      decision: APPROVED_REQUEST_STATUS,
    })

    // Assert — refused, and the product left in pre-press.
    expect(error).not.toBeNull()
    expect((await database.productState(product.id)).status).toBe(PREPRESS_STATUS)
  })
})

test.describe('unmailed request', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, approvalRequestSeed: PENDING_UNMAILED_REQUEST })

  test('APR-REQ-017 withdrawing the request queues no mail', async ({ database, order, approvalRequest }) => {
    // Setup
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act
    await asEmployee.rpc('withdraw_approval_request', { request_id: approvalRequest.id })

    // Assert — the customer was never mailed, so nothing tells them the link is gone.
    expect(await database.queuedEmails(order.id)).toHaveLength(0)
  })
})
