import {
  DECADE_OLD_BACKUP_JOB,
  DELIVERED_BACKUP_JOB,
  EARLY_IN_MONTH_BACKUP_JOB,
  LATE_IN_MONTH_BACKUP_JOB,
  OTHER_MACHINE,
  REMOVAL_ANNOUNCED_BACKUP_JOB,
  REMOVED_BACKUP_JOB,
  THIS_MACHINE,
} from '../fixtures/backupJobs'
import { LONG_WEEKLY_RETENTION_BACKUP_SETTINGS } from '../fixtures/backupSettings'
import { expect, test } from '../fixtures/orders'
import { TEST_USERS } from '../fixtures/users'

// The retention rule of the shop folder (BACKUP_RUNTIME.md, WP8), driven
// against the database with no screen involved: list_backups_due_for_removal
// read through the runner's connection, report_backup_removed called by a
// signed-in admin as a running copy of the app calls it, and the upkeep run
// on demand as its cron job runs it. The rule compares jobs, so `backupJobs`
// seeds every job a case needs, the one it is about first; the dates are
// fixed mid-month (see fixtures/backupJobs). `backupSettings` is named where
// a case turns on the retention settings, to have the fixture write them.
// The local stack runs the same upkeep every five minutes on its own, which
// can only do what the test's run does a little earlier.

// ── The rule ────────────────────────────────────────────────────────────────

test.describe('delivered job past the weekly retention, a later job made the same month', () => {
  test.use({ backupJobSeeds: [[EARLY_IN_MONTH_BACKUP_JOB, LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-001 listing the backups due for removal includes the job', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).toContain(backupJobs[0].id)
  })
})

test.describe('delivered job inside the weekly retention, a later job made the same month', () => {
  test.use({
    backupSettingsSeed: LONG_WEEKLY_RETENTION_BACKUP_SETTINGS,
    backupJobSeeds: [[EARLY_IN_MONTH_BACKUP_JOB, LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }],
  })

  test('BKP-RET-002 listing the backups due for removal leaves the job out', async ({ database, backupSettings: _longRetention, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).not.toContain(backupJobs[0].id)
  })
})

test.describe('last delivered job of its month, past the weekly retention, inside the monthly one', () => {
  test.use({ backupJobSeeds: [[LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-003 listing the backups due for removal leaves the job out', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).not.toContain(backupJobs[0].id)
  })
})

test.describe('last delivered job of its month, past the monthly retention', () => {
  test.use({ backupJobSeeds: [[DECADE_OLD_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-004 listing the backups due for removal includes the job', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).toContain(backupJobs[0].id)
  })
})

test.describe('newest delivered job, past the monthly retention', () => {
  test.use({ backupJobSeeds: [[DECADE_OLD_BACKUP_JOB], { scope: 'test' }] })

  // `backupAlerts` is named so a missing-backup mail the local upkeep may queue
  // for this ten-year-old newest job is removed afterwards.
  test('BKP-RET-005 listing the backups due for removal leaves the job out', async ({ database, backupSettings: _shipped, backupAlerts: _cleared, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).not.toContain(backupJobs[0].id)
  })
})

test.describe('job due for removal, already reported removed', () => {
  test.use({ backupJobSeeds: [[REMOVED_BACKUP_JOB, LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-006 listing the backups due for removal leaves the job out', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    const due = await database.backupJobsDueForRemoval()

    // Assert
    expect(due).not.toContain(backupJobs[0].id)
  })
})

// ── The report and the upkeep ───────────────────────────────────────────────

test.describe('job due for removal', () => {
  test.use({ backupJobSeeds: [[EARLY_IN_MONTH_BACKUP_JOB, LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-007 reporting the removal stamps the job with the time and the machine', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Setup — a connection that calls as the admin, not as the runner.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    await asAdmin.rpc('report_backup_removed', { job_id: backupJobs[0].id, machine: THIS_MACHINE })

    // Assert
    const stored = await database.backupJob(backupJobs[0].id)
    expect(stored.removed_at).not.toBeNull()
    expect(stored.removed_by_machine).toBe(THIS_MACHINE)
  })

  test('BKP-RET-008 reporting the removal a second time keeps the first stamp', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act — this machine reports first, another one after it.
    await asAdmin.rpc('report_backup_removed', { job_id: backupJobs[0].id, machine: THIS_MACHINE })
    await asAdmin.rpc('report_backup_removed', { job_id: backupJobs[0].id, machine: OTHER_MACHINE })

    // Assert — the first report is the record.
    expect((await database.backupJob(backupJobs[0].id)).removed_by_machine).toBe(THIS_MACHINE)
  })

  test('BKP-RET-009 running the upkeep stamps the job as announced for removal', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert
    expect((await database.backupJob(backupJobs[0].id)).removal_announced_at).not.toBeNull()
  })
})

test.describe('job due for removal, its deletion asked for five minutes ago', () => {
  test.use({ backupJobSeeds: [[REMOVAL_ANNOUNCED_BACKUP_JOB, LATE_IN_MONTH_BACKUP_JOB, DELIVERED_BACKUP_JOB], { scope: 'test' }] })

  test('BKP-RET-010 running the upkeep again inside the re-announce interval leaves the announcement as it was', async ({ database, backupSettings: _shipped, backupJobs }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert — still the seeded announcement.
    expect(Date.parse((await database.backupJob(backupJobs[0].id)).removal_announced_at ?? '')).toBe(
      Date.parse(backupJobs[0].removal_announced_at ?? ''),
    )
  })
})
