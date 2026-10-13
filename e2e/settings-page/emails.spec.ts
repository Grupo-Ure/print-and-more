import { expect, test } from '../fixtures/emails'
import { EDITED_DELAY_DAYS, IMMEDIATE_TEST_MESSAGE, SETTINGS_DELAYED_TEST_MESSAGE } from '../fixtures/emailMessages'
import { queuedDelayDays } from '../support/database'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page. The `emailSetting` fixture writes
// test-message's row — on, sent at once — and deletes it afterwards; the
// mail is queued straight through queue_email, as a feature's trigger would.
test.use({ user: TEST_USERS.admin })

test('setting a delay makes the next mail queued for it wait that many days', async ({ settingsPage, database, order, emailSetting }) => {
  // Setup — the Emails section open on test-message's row.
  await settingsPage.openSection('emails')
  const { emails } = settingsPage
  const delay = emails.rowDelay(emails.row(emailSetting.template))

  // Act — type the delay, leave the field, wait for it to be stored, then queue the mail.
  await delay.fill(String(EDITED_DELAY_DAYS))
  await delay.press('Enter')
  await emails.stored(delay, EDITED_DELAY_DAYS).waitFor()
  await database.queueEmail(order.id, SETTINGS_DELAYED_TEST_MESSAGE)

  // Assert — one mail waiting, due that many days after it was queued.
  expect((await database.queuedEmails(order.id)).map(queuedDelayDays)).toEqual([EDITED_DELAY_DAYS])

  // Cleanup — the mail waits days; take it off the queue.
  await database.archiveQueuedEmails(order.id)
})

test('switching a mail off makes queuing it queue nothing', async ({ settingsPage, database, order, emailSetting }) => {
  // Setup — the Emails section open on test-message's row.
  await settingsPage.openSection('emails')
  const { emails } = settingsPage
  const row = emails.row(emailSetting.template)

  // Act — switch it off, wait for it to be stored, then try to queue the mail.
  await emails.rowEnabled(row).click()
  await emails.rowSwitchedOff(row).waitFor()
  await database.tryQueueEmail(order.id, IMMEDIATE_TEST_MESSAGE)

  // Assert — nothing waiting for the order.
  expect(await database.queuedEmails(order.id)).toHaveLength(0)
})
