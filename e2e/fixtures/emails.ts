/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * **emails**. Adds the runner's handles on the two functions (`sendEmail`,
 * `emailWebhook`), a message queued for the test's order (`queuedEmail`), a
 * sent record for it (`sentEmail`), and a template's row in Settings → Emails
 * (`emailSetting`). It sits above `orders` because a message is about an
 * order, and `sent_emails` references one.
 *
 * The fixture queues and records; it never drains and never reports.
 * Draining and reporting are what the specs are about, so they are written
 * inline in their Act stage.
 */
import { test as base, reloadApp } from './orders'
import {
  IMMEDIATE_TEST_MESSAGE,
  IMMEDIATE_TEST_MESSAGE_SETTING,
  SENT_TEST_MESSAGE,
  type EmailSettingSeed,
  type QueuedEmailSeed,
  type SentEmailSeed,
} from './emailMessages'
import { SendEmailFunction } from '../support/sendEmail'
import { EmailWebhookFunction } from '../support/emailWebhook'
import type { TestSentEmail } from '../support/database'

/** What a spec gets to know about the message the fixture queued for it. */
export type QueuedEmail = {
  msgId: number
  orderId: string
}

type EmailFixtures = {
  /** The `send-email` edge function, called the way the cron calls it. */
  sendEmail: SendEmailFunction
  /** The `email-webhook` edge function, called the way Resend calls it. */
  emailWebhook: EmailWebhookFunction
  /** What `sentEmail` records; override per describe block with `test.use({ sentEmailSeed })`. */
  sentEmailSeed: SentEmailSeed
  /**
   * A sent record for `order`, as the sender would have written it after the
   * provider accepted the mail, with a provider id of its own for a delivery
   * report to name. Removed with the order.
   */
  sentEmail: TestSentEmail
  /** What `queuedEmail` queues; override per describe block with `test.use({ queuedEmailSeed })`. */
  queuedEmailSeed: QueuedEmailSeed
  /**
   * A message queued for `order` through `queue_email`, as a trigger would
   * queue it. Afterwards everything still on the queue for the order is
   * archived — this message and any repeat the sender queued after it — so a
   * message a test left waiting cannot be claimed by the next test's drain.
   */
  queuedEmail: QueuedEmail
  /** What `emailSetting` writes; override per describe block with `test.use({ emailSettingSeed })`. */
  emailSettingSeed: EmailSettingSeed
  /**
   * The template's row in Settings → Emails, as `emailSettingSeed` describes
   * it, written before the test and deleted after it — so a delay or a switch
   * a test changed does not reach the next one. The app is reloaded so the
   * Settings page shows the row.
   */
  emailSetting: EmailSettingSeed
}

export const test = base.extend<EmailFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
  sendEmail: async ({}, use) => {
    await use(new SendEmailFunction())
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
  emailWebhook: async ({}, use) => {
    await use(new EmailWebhookFunction())
  },

  sentEmailSeed: [SENT_TEST_MESSAGE, { option: true }],

  sentEmail: async ({ database, order, sentEmailSeed }, use) => {
    await use(await database.createSentEmail(order.id, sentEmailSeed))
  },

  queuedEmailSeed: [IMMEDIATE_TEST_MESSAGE, { option: true }],

  queuedEmail: async ({ database, order, queuedEmailSeed }, use) => {
    const msgId = await database.queueEmail(order.id, queuedEmailSeed)

    await use({ msgId, orderId: order.id })
    await database.archiveQueuedEmails(order.id)
  },

  emailSettingSeed: [IMMEDIATE_TEST_MESSAGE_SETTING, { option: true }],

  emailSetting: async ({ page, navbar, database, emailSettingSeed }, use) => {
    await database.upsertEmailSetting(emailSettingSeed)
    await reloadApp(page, navbar)

    await use(emailSettingSeed)
    await database.removeEmailSetting(emailSettingSeed.template)
  },
})

export { expect } from '@playwright/test'
