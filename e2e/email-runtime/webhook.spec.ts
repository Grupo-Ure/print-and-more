import { expect, test } from '../fixtures/emails'
import {
  CORRECTED_CUSTOMER_EMAIL,
  EMAIL_BOUNCED_HISTORY_EVENT,
  PERMANENT_BOUNCE,
  REFUSED_REPORT_STATUS,
  WRONG_WEBHOOK_SECRET,
  bouncedReport,
  deliveredReport,
} from '../fixtures/emailMessages'

// The provider's delivery reports, posted to the local email-webhook function
// signed the way the provider signs them. `sentEmail` is a sent record for the
// test's order, addressed to its customer, with a provider id of its own for
// the report to name. No mail is involved: the record is inserted, not sent.

// ── Delivered ─────────────────────────────────────────────────────────────

test('EML-WHK-001 a delivery report marks the sent mail as delivered', async ({ database, emailWebhook, sentEmail }) => {
  // Act
  await emailWebhook.report(deliveredReport(sentEmail.providerId))

  // Assert
  expect((await database.sentEmailDelivery(sentEmail.id)).delivered_at).not.toBeNull()
})

// ── Bounced ───────────────────────────────────────────────────────────────

test("EML-WHK-002 a bounce report marks the sent mail as bounced with the provider's reason", async ({ database, emailWebhook, sentEmail }) => {
  // Act
  await emailWebhook.report(bouncedReport(sentEmail.providerId))

  // Assert
  const delivery = await database.sentEmailDelivery(sentEmail.id)
  expect(delivery.bounced_at).not.toBeNull()
  expect(delivery.bounce_reason).toBe(PERMANENT_BOUNCE.reason)
})

test("EML-WHK-003 a bounce report writes a bounce entry on the order's history", async ({ database, emailWebhook, sentEmail }) => {
  // Act
  await emailWebhook.report(bouncedReport(sentEmail.providerId))

  // Assert
  expect(await database.historyCount(sentEmail.orderId, EMAIL_BOUNCED_HISTORY_EVENT)).toBe(1)
})

test("EML-WHK-004 a bounce report flags the customer's address as bounced", async ({ database, emailWebhook, sentEmail, order }) => {
  // Act
  await emailWebhook.report(bouncedReport(sentEmail.providerId))

  // Assert
  expect(await database.customerEmailBouncedAt(order.customerId)).not.toBeNull()
})

test('EML-WHK-005 the same bounce report delivered twice writes one history entry', async ({ database, emailWebhook, sentEmail }) => {
  // Act — the provider retries a report it is unsure about.
  await emailWebhook.report(bouncedReport(sentEmail.providerId))
  await emailWebhook.report(bouncedReport(sentEmail.providerId))

  // Assert
  expect(await database.historyCount(sentEmail.orderId, EMAIL_BOUNCED_HISTORY_EVENT)).toBe(1)
})

test('EML-WHK-006 changing the customer\'s email address clears the bounce flag', async ({ database, emailWebhook, sentEmail, order }) => {
  // Setup — the address has bounced.
  await emailWebhook.report(bouncedReport(sentEmail.providerId))

  // Act — the customer is saved with a corrected address.
  await database.updateCustomerEmail(order.customerId, CORRECTED_CUSTOMER_EMAIL)

  // Assert
  expect(await database.customerEmailBouncedAt(order.customerId)).toBeNull()
})

// ── The signature check ───────────────────────────────────────────────────

test('EML-WHK-007 a report signed with another secret is refused and marks nothing', async ({ database, emailWebhook, sentEmail }) => {
  // Act
  const status = await emailWebhook.reportSignedWith(WRONG_WEBHOOK_SECRET, deliveredReport(sentEmail.providerId))

  // Assert — refused, and the record untouched.
  expect(status).toBe(REFUSED_REPORT_STATUS)
  expect((await database.sentEmailDelivery(sentEmail.id)).delivered_at).toBeNull()
})
