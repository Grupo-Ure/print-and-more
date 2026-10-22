import { expect, test } from '../fixtures/emails'
import {
  EDITED_DELAY_DAYS,
  EDITED_SUBJECT,
  IMMEDIATE_TEST_MESSAGE,
  MAIL_TEMPLATES,
  SETTINGS_DELAYED_TEST_MESSAGE,
  UNOFFERED_SLOT_BODY,
} from '../fixtures/emailMessages'
import { queuedDelayDays } from '../support/database'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page. The `emailSetting` fixture writes
// test-message's row — on, sent at once — and puts it back afterwards; the
// mail is queued straight through queue_email, as a feature's trigger would.
test.use({ user: TEST_USERS.admin })

test('SET-EML-001 setting a delay makes the next mail queued for it wait that many days', async ({ settingsPage, database, order, emailSetting }) => {
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

test('SET-EML-002 switching a mail off makes queuing it queue nothing', async ({ settingsPage, database, order, emailSetting }) => {
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

test('SET-EML-003 saving a changed subject in the wording dialog makes the next sent mail carry it', async ({ settingsPage, database, sendEmail, order, emailSetting }) => {
  // Setup — the Emails section open on test-message's row.
  await settingsPage.openSection('emails')
  const { emails } = settingsPage
  const dialog = emails.wordingDialog

  // Act — open the wording, type the subject, save and wait for the dialog to
  // close, then queue the mail and drain.
  await emails.rowEditWording(emails.row(emailSetting.template)).click()
  await dialog.subject.fill(EDITED_SUBJECT)
  await dialog.submit.click()
  await dialog.root.waitFor({ state: 'hidden' })
  await database.queueEmail(order.id, IMMEDIATE_TEST_MESSAGE)
  await sendEmail.drain()

  // Assert — the mail went out under the new subject.
  expect((await database.sentEmails(order.id)).map(sent => sent.subject)).toEqual([EDITED_SUBJECT])
})

test('SET-EML-004 saving wording with a placeholder the mail does not offer is refused', async ({ settingsPage, database, emailSetting }) => {
  // Setup — the Emails section open on test-message's row, and its body as stored.
  await settingsPage.openSection('emails')
  const { emails } = settingsPage
  const dialog = emails.wordingDialog
  const before = await database.emailSetting(emailSetting.template)

  // Act — type a body with a slot test-message does not have, save, and wait for the refusal.
  await emails.rowEditWording(emails.row(emailSetting.template)).click()
  await dialog.body.fill(UNOFFERED_SLOT_BODY)
  await dialog.submit.click()
  await dialog.error.waitFor()

  // Assert — the stored body is unchanged.
  expect((await database.emailSetting(emailSetting.template)).body).toBe(before.body)
})

test('SET-EML-005 opening the emails section lists every mail type, the immediate ones included', async ({ settingsPage }) => {
  // Act
  await settingsPage.openSection('emails')

  // Assert — one row per mail the sender knows; test-message is sent at once.
  await expect.poll(async () => new Set(await settingsPage.emails.renderedTemplates())).toEqual(new Set(MAIL_TEMPLATES))
})
