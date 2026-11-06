import { expect, reloadApp, test } from '../fixtures/orders'
import { EDITED_DUMP_INTERVAL_DAYS } from '../fixtures/backupSettings'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page. The `backupSettings` fixture writes the
// settings at their defaults and writes them back afterwards.
test.use({ user: TEST_USERS.admin })

test('SET-BKP-001 opening Settings lists the backups section', async ({ settingsPage }) => {
  // Act — open the Settings page.
  await settingsPage.open()

  // Assert — the section's link is in the list.
  await expect(settingsPage.sectionLink('backups')).toBeVisible()
})

test('SET-BKP-002 changing the backup interval shows the new value again after reopening Settings', async ({ settingsPage, page, navbar, backupSettings }) => {
  // Setup — the Backups section open, the field holding the seeded interval.
  await settingsPage.openSection('backups')
  const { backups } = settingsPage
  const interval = backups.dumpIntervalDays
  await backups.stored(interval, backupSettings.dump_interval_days).waitFor()

  // Act — type the interval, leave the field, wait for it to be stored, then reload the app and reopen the section.
  await interval.fill(String(EDITED_DUMP_INTERVAL_DAYS))
  await interval.press('Enter')
  await backups.stored(interval, EDITED_DUMP_INTERVAL_DAYS).waitFor()
  await reloadApp(page, navbar)
  await settingsPage.openSection('backups')

  // Assert — the field shows the stored interval, read afresh from the database.
  await expect(interval).toHaveAttribute('data-value', String(EDITED_DUMP_INTERVAL_DAYS))
})
