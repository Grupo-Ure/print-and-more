import {
  DELIVERED_PAST_RETENTION_BACKUP_JOB,
  DELIVERED_WITHIN_RETENTION_BACKUP_JOB,
  UNANSWERED_BACKUP_JOB,
} from '../fixtures/backupJobs'
import { DISABLED_BACKUP_SETTINGS, START_DISABLED_OUTCOME } from '../fixtures/backupSettings'
import { expect, test } from '../fixtures/orders'

// The two scheduled backup functions, called on demand through the runner's
// connection the way their cron jobs call them; the outcome is read back the
// same way. A run acts on every due job in the database, so only seeds meant
// for it are due. The purge stamps the row at once; the bucket delete goes out
// after it commits, so the bucket is polled. The local stack runs the same
// upkeep every five minutes on its own, which can only do what the test's run
// does a little earlier. The intervals are the settings' shipped defaults,
// which the seeds are dated against.

// ── Purge ───────────────────────────────────────────────────────────────────

test.describe('delivered job past the holding retention', () => {
  test.use({ backupJobSeed: DELIVERED_PAST_RETENTION_BACKUP_JOB })

  test("BKP-SCHED-001 running the upkeep removes the job's online copy from the bucket", async ({ database, backupJob }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert — the copy is gone once Storage has taken the delete.
    await expect.poll(() => database.backupFileStored(backupJob.storage_path)).toBe(false)
  })

  test('BKP-SCHED-002 running the upkeep marks the job as purged', async ({ database, backupJob }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert
    expect((await database.backupJob(backupJob.id)).purged_at).not.toBeNull()
  })
})

test.describe('delivered job inside the holding retention', () => {
  test.use({ backupJobSeed: DELIVERED_WITHIN_RETENTION_BACKUP_JOB })

  test('BKP-SCHED-003 running the upkeep leaves the job unpurged', async ({ database, backupJob }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert
    expect((await database.backupJob(backupJob.id)).purged_at).toBeNull()
  })
})

// ── Re-announce ─────────────────────────────────────────────────────────────

test.describe('waiting job announced longer ago than the re-announce interval', () => {
  test.use({ backupJobSeed: UNANSWERED_BACKUP_JOB })

  test('BKP-SCHED-004 running the upkeep calls the roll for the job again', async ({ database, backupJob }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert — announced since the seed's backdated call.
    const stored = await database.backupJob(backupJob.id)
    expect(Date.parse(stored.announced_at ?? '')).toBeGreaterThan(Date.parse(backupJob.announced_at ?? ''))
  })
})

// ── Start ───────────────────────────────────────────────────────────────────

test.describe('backups switched off', () => {
  test.use({ backupSettingsSeed: DISABLED_BACKUP_SETTINGS })

  // `backupSettings` is named only to have the fixture write the switched-off row.
  test('BKP-SCHED-005 running the daily start reports backups as switched off', async ({ database, backupSettings: _switchedOff }) => {
    // Act
    const outcome = await database.startDueBackup()

    // Assert — nothing was started.
    expect(outcome).toBe(START_DISABLED_OUTCOME)
  })
})
