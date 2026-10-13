import { expect, test } from '../../fixtures/emails'
import { DELAYED_TEST_MESSAGE, UNKNOWN_TEMPLATE_MESSAGE } from '../../fixtures/emailMessages'

// The `queuedEmail` fixture queues one message for the order through
// queue_email; a drain in Setup turns it into a sent or a failed mail before
// the tab is opened. The sender runs with EMAIL_DRY_RUN=true, so nothing leaves.

test.describe('mail not due for an hour', () => {
  test.use({ queuedEmailSeed: DELAYED_TEST_MESSAGE })

  test('opening the emails tab lists the mail as waiting to go', async ({ ordersPage, queuedEmail }) => {
    // Setup — the order open.
    await ordersPage.openOrder(queuedEmail.orderId)

    // Act
    await ordersPage.details.emailsTab.click()

    // Assert
    await expect(ordersPage.details.emails.queued(queuedEmail.msgId)).toHaveCount(1)
  })
})

test('opening the emails tab lists a drained mail as sent', async ({ ordersPage, sendEmail, queuedEmail }) => {
  // Setup — the message sent, then the order open.
  await sendEmail.drain()
  await ordersPage.openOrder(queuedEmail.orderId)

  // Act
  await ordersPage.details.emailsTab.click()

  // Assert
  await expect(ordersPage.details.emails.sentItems).toHaveCount(1)
})

test('viewing a sent mail opens it as it went out', async ({ ordersPage, sendEmail, queuedEmail }) => {
  // Setup — the message sent, the order open on its emails tab.
  await sendEmail.drain()
  await ordersPage.openOrder(queuedEmail.orderId)
  await ordersPage.details.emailsTab.click()

  // Act
  await ordersPage.details.emails.viewSent.click()

  // Assert
  await expect(ordersPage.details.emails.sentDialog).toBeVisible()
})

test.describe('message naming an unknown template', () => {
  test.use({ queuedEmailSeed: UNKNOWN_TEMPLATE_MESSAGE })

  test('opening the emails tab lists the given-up mail as failed', async ({ ordersPage, sendEmail, queuedEmail }) => {
    // Setup — the sender gives the message up, then the order open.
    await sendEmail.drain()
    await ordersPage.openOrder(queuedEmail.orderId)

    // Act
    await ordersPage.details.emailsTab.click()

    // Assert
    await expect(ordersPage.details.emails.failedItems).toHaveCount(1)
  })
})
