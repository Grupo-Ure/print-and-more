import { expect, reloadApp, test } from '../fixtures/orders'
import { EDITED_DUMP_INTERVAL_DAYS } from '../fixtures/backupSettings'
import {
  DELIVERED_BACKUP_JOB,
  OVERDUE_BACKUP_JOB,
  PURGED_BACKUP_JOB,
  RETRIED_BACKUP_JOB,
  STALE_BACKUP_JOB,
  TAKEN_BACKUP_JOB,
} from '../fixtures/backupJobs'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page. The `backupSettings` fixture writes the
// settings at their defaults and writes them back afterwards; the `backupJob`
// fixture inserts one job in the state its describe block names and removes
// it afterwards.
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

test.describe('backup waiting again after failed deliveries', () => {
  test.use({ backupJobSeed: RETRIED_BACKUP_JOB })

  test("SET-BKP-003 opening the backups section shows the job's failed attempts", async ({ settingsPage, backupJob, backupJobSeed }) => {
    // Act — open the Backups section.
    await settingsPage.openSection('backups')

    // Assert — the row counts the seeded failures.
    await expect(settingsPage.backups.jobAttempts(backupJob.id)).toHaveAttribute('data-value', String(backupJobSeed.failures?.attempts))
  })

  test("SET-BKP-004 opening the backups section shows why the job's last delivery failed", async ({ settingsPage, backupJob, backupJobSeed }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert — the reason is the behaviour here, so the row is read for its text.
    await expect(settingsPage.backups.jobLastError(backupJob.id)).toHaveText(String(backupJobSeed.failures?.lastError))
  })
})

test.describe('backup being delivered by another machine', () => {
  test.use({ backupJobSeed: TAKEN_BACKUP_JOB })

  test('SET-BKP-005 opening the backups section names the machine holding the job', async ({ settingsPage, backupJob, backupJobSeed }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobTakenBy(backupJob.id)).toHaveText(String(backupJobSeed.claim?.machine))
  })
})

test.describe('backup delivered, online copy kept', () => {
  test.use({ backupJobSeed: DELIVERED_BACKUP_JOB })

  test('SET-BKP-006 opening the backups section names the machine that delivered the job', async ({ settingsPage, backupJob, backupJobSeed }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobDeliveredBy(backupJob.id)).toHaveText(String(backupJobSeed.claim?.machine))
  })

  test("SET-BKP-007 opening the backups section shows the job's online copy as kept", async ({ settingsPage, backupJob }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobHoldingCopy(backupJob.id)).toHaveAttribute('data-purged', 'false')
  })
})

test.describe('backup delivered, online copy purged', () => {
  test.use({ backupJobSeed: PURGED_BACKUP_JOB })

  test("SET-BKP-008 opening the backups section shows the job's online copy as deleted", async ({ settingsPage, backupJob }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobHoldingCopy(backupJob.id)).toHaveAttribute('data-purged', 'true')
  })
})

// The two flags below are judged against the settings' shipped thresholds,
// which the `backupSettings` fixture writes and the seeds are dated against.

test.describe('backup waiting longer than the undelivered alert threshold', () => {
  test.use({ backupJobSeed: OVERDUE_BACKUP_JOB })

  // `backupSettings` is named only to have the fixture write the shipped thresholds.
  test('SET-BKP-009 opening the backups section flags the job as undelivered with the days since it was made', async ({ settingsPage, backupSettings: _thresholds, backupJob, backupJobSeed }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobUndeliveredFlag(backupJob.id)).toHaveAttribute('data-days', String(backupJobSeed.createdDaysAgo))
  })
})

test.describe('newest backup made longer ago than the missing-backup alert threshold', () => {
  test.use({ backupJobSeed: STALE_BACKUP_JOB })

  // `backupSettings` is named only to have the fixture write the shipped thresholds.
  test('SET-BKP-010 opening the backups section flags the newest job with the days without a new backup', async ({ settingsPage, backupSettings: _thresholds, backupJob, backupJobSeed }) => {
    // Act
    await settingsPage.openSection('backups')

    // Assert
    await expect(settingsPage.backups.jobMissingFlag(backupJob.id)).toHaveAttribute('data-days', String(backupJobSeed.createdDaysAgo))
  })
})
