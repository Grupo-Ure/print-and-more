/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * **emails**. Adds the runner's handle on the sender (`sendEmail`) and a
 * message queued for the test's order (`queuedEmail`). It sits above `orders`
 * because a message is about an order, and `sent_emails` references one.
 *
 * The fixture queues; it never drains. Draining is what the specs are about,
 * so it is written inline in their Act stage.
 */
import { test as base } from './orders'
import { IMMEDIATE_TEST_MESSAGE, type QueuedEmailSeed } from './emailMessages'
import { SendEmailFunction } from '../support/sendEmail'

/** What a spec gets to know about the message the fixture queued for it. */
export type QueuedEmail = {
  msgId: number
  orderId: string
}

type EmailFixtures = {
  /** The `send-email` edge function, called the way the cron calls it. */
  sendEmail: SendEmailFunction
  /** What `queuedEmail` queues; override per describe block with `test.use({ queuedEmailSeed })`. */
  queuedEmailSeed: QueuedEmailSeed
  /**
   * A message queued for `order` through `queue_email`, as a trigger would
   * queue it. Archived after the test whether or not a drain got to it, so a
   * message a test left waiting cannot be claimed by the next test's drain.
   */
  queuedEmail: QueuedEmail
}

export const test = base.extend<EmailFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures declare dependencies by destructuring
  sendEmail: async ({}, use) => {
    await use(new SendEmailFunction())
  },

  queuedEmailSeed: [IMMEDIATE_TEST_MESSAGE, { option: true }],

  queuedEmail: async ({ database, order, queuedEmailSeed }, use) => {
    const msgId = await database.queueEmail(order.id, queuedEmailSeed)

    await use({ msgId, orderId: order.id })
    await database.archiveEmail(msgId)
  },
})

export { expect } from '@playwright/test'
