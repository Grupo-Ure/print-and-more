import { expect, test } from '../fixtures/emails'
import { REPEATING_TEST_MESSAGE_SETTING, SWITCHED_OFF } from '../fixtures/emailMessages'
import { queuedDelayDays } from '../support/database'

// What a template's row in Settings → Emails changes about a drain. The
// `emailSetting` fixture writes test-message's row and deletes it afterwards;
// `queuedEmail` queues one test-message, due at once. The sender runs with
// EMAIL_DRY_RUN=true, so nothing leaves.

test.describe('test-message repeated once a day, sent twice at most', () => {
  test.use({ emailSettingSeed: REPEATING_TEST_MESSAGE_SETTING })

  test('sending the mail queues its repeat one repeat interval out', async ({ database, sendEmail, queuedEmail, emailSetting }) => {
    // Act — the first send.
    await sendEmail.drain()

    // Assert — one repeat waiting, due one interval after it was queued.
    expect((await database.queuedEmails(queuedEmail.orderId)).map(queuedDelayDays)).toEqual([emailSetting.repeat_days])
  })

  test('draining each send as it comes due stops the mail at its maximum', async ({ database, sendEmail, queuedEmail, emailSetting }) => {
    // Act — the first send, then its repeat made due and sent.
    await sendEmail.drain()
    await database.makeQueuedEmailsDue(queuedEmail.orderId)
    await sendEmail.drain()

    // Assert — sent the maximum number of times, and no further repeat waiting.
    expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(emailSetting.max_sends)
    expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
  })
})

test('draining the queue archives unsent a waiting mail switched off since it was queued', async ({ database, sendEmail, queuedEmail, emailSetting }) => {
  // Setup — the mail is already waiting (queuedEmail); now it is switched off.
  await database.updateEmailSetting(emailSetting.template, SWITCHED_OFF)

  // Act
  await sendEmail.drain()

  // Assert — nothing sent, nothing waiting.
  expect(await database.sentEmails(queuedEmail.orderId)).toHaveLength(0)
  expect(await database.queuedEmails(queuedEmail.orderId)).toHaveLength(0)
})
