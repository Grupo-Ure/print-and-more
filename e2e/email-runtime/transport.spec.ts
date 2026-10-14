import { expect, test } from '../fixtures/emails'
import {
  DELAYED_TEST_MESSAGE,
  EMAIL_FAILED_HISTORY_EVENT,
  MAX_SEND_ATTEMPTS,
  REFUSED_CALLER_STATUS,
  REFUSED_TEST_MESSAGE,
  UNKNOWN_TEMPLATE_MESSAGE,
  UNNEEDED_TEST_MESSAGE,
} from '../fixtures/emailMessages'
import { TEST_USERS } from '../fixtures/users'

// The sender runs with EMAIL_DRY_RUN=true here: the whole path — claim, still
// needed?, resolve, render, record, archive, history — runs, and no mail leaves.

// ── The main path ─────────────────────────────────────────────────────────

test('EML-TRN-001 draining the queue turns the queued message into a sent record and takes it off the queue', async ({ database, sendEmail, queuedEmail }) => {
  // Act — one drain, as the cron would make it.
  await sendEmail.drain()

  // Assert — the order has one sent record and nothing left waiting.
  expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(1)
  expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
})

test('EML-TRN-002 draining the queue a second time sends nothing twice', async ({ database, sendEmail, queuedEmail }) => {
  // Act — two drains in a row.
  await sendEmail.drain()
  await sendEmail.drain()

  // Assert — still one sent record.
  expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(1)
})

// ── Timing ────────────────────────────────────────────────────────────────

test.describe('message not due for an hour', () => {
  test.use({ queuedEmailSeed: DELAYED_TEST_MESSAGE })

  test('EML-TRN-003 draining the queue leaves the message waiting unsent', async ({ database, sendEmail, queuedEmail }) => {
    // Act
    await sendEmail.drain()

    // Assert — nothing sent; the message is still on the queue.
    expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(0)
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(1)
  })

  test('EML-TRN-004 making the message due and draining the queue sends it', async ({ database, sendEmail, queuedEmail }) => {
    // Act — bring the due time forward, then drain.
    await database.makeEmailDue(queuedEmail.msgId)
    await sendEmail.drain()

    // Assert
    expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(1)
  })
})

// ── The caller check ──────────────────────────────────────────────────────

test('EML-TRN-005 calling the drain with a user session instead of the service-role key is refused', async ({ database, sendEmail, queuedEmail }) => {
  // Setup — a signed-in user's access token.
  const accessToken = await database.accessTokenOf(TEST_USERS.employee)

  // Act
  const status = await sendEmail.drainAs(accessToken)

  // Assert — refused, and the message untouched.
  expect(status).toBe(REFUSED_CALLER_STATUS)
  expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(0)
})

// ── What is not sent ──────────────────────────────────────────────────────

test.describe('message naming an unknown template', () => {
  test.use({ queuedEmailSeed: UNKNOWN_TEMPLATE_MESSAGE })

  test('EML-TRN-006 draining the queue archives the message with a failure entry on the order', async ({ database, sendEmail, queuedEmail }) => {
    // Act
    await sendEmail.drain()

    // Assert — one failure entry; the message is gone from the queue.
    expect(await database.historyCount(queuedEmail.orderId, EMAIL_FAILED_HISTORY_EVENT)).toBe(1)
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
  })
})

test.describe('message whose template says it is no longer needed', () => {
  test.use({ queuedEmailSeed: UNNEEDED_TEST_MESSAGE })

  test('EML-TRN-007 draining the queue archives the message unsent', async ({ database, sendEmail, queuedEmail }) => {
    // Act
    await sendEmail.drain()

    // Assert — nothing sent, nothing waiting.
    expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(0)
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
  })
})

// ── Refusals ──────────────────────────────────────────────────────────────

test.describe('message the provider refuses', () => {
  test.use({ queuedEmailSeed: REFUSED_TEST_MESSAGE })

  test('EML-TRN-008 a refused send leaves the message on the queue with nothing recorded', async ({ database, sendEmail, queuedEmail }) => {
    // Act
    await sendEmail.drain()

    // Assert — still queued (claimed, to come back); no record, no failure entry yet.
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(1)
    expect(await database.historyCount(queuedEmail.orderId, EMAIL_FAILED_HISTORY_EVENT)).toBe(0)
  })

  test('EML-TRN-009 the last allowed refusal archives the message with a failure entry on the order', async ({ database, sendEmail, queuedEmail }) => {
    // Act — every allowed attempt, making the message due again between drains
    // in place of waiting out its visibility timeout.
    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
      await sendEmail.drain()
      await database.makeEmailDue(queuedEmail.msgId)
    }

    // Assert — one failure entry; the message is gone from the queue.
    expect(await database.historyCount(queuedEmail.orderId, EMAIL_FAILED_HISTORY_EVENT)).toBe(1)
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
  })
})
