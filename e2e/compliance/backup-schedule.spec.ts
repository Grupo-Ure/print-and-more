import {
  DELIVERED_PAST_RETENTION_BACKUP_JOB,
  DELIVERED_WITHIN_RETENTION_BACKUP_JOB,
  OVERDUE_BACKUP_JOB,
  STALE_BACKUP_JOB,
  UNANSWERED_BACKUP_JOB,
} from '../fixtures/backupJobs'
import { FAILED_BACKUP_DISPATCH, TIMED_OUT_BACKUP_DISPATCH } from '../fixtures/backupDispatches'
import {
  DISABLED_BACKUP_SETTINGS,
  START_ALREADY_STARTED_OUTCOME,
  START_DISABLED_OUTCOME,
  START_NO_TOKEN_OUTCOME,
} from '../fixtures/backupSettings'
import { BACKUP_ALERT_RECIPIENTS, BACKUP_MISSING_TEMPLATE, BACKUP_UNDELIVERED_TEMPLATE } from '../fixtures/emailMessages'
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

// ── Alerts ──────────────────────────────────────────────────────────────────
// The `backupAlerts` fixture clears every alert on record before and after,
// so the once-a-day rule starts afresh; it is named only for that. What the
// upkeep queued is read from its alert records, one per message.

test.describe('waiting job made longer ago than the undelivered alert threshold', () => {
  test.use({ backupJobSeed: OVERDUE_BACKUP_JOB })

  test('BKP-SCHED-006 running the upkeep queues the undelivered-backup mail once to the shop and once to the developers', async ({ database, backupAlerts: _cleared, backupJob: _overdue }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert
    expect((await database.backupAlertRecipients(BACKUP_UNDELIVERED_TEMPLATE)).sort()).toEqual(BACKUP_ALERT_RECIPIENTS)
  })

  test('BKP-SCHED-007 running the upkeep a second time the same day queues no further mail', async ({ database, backupAlerts: _cleared, backupJob: _overdue }) => {
    // Act
    await database.runBackupUpkeep()
    await database.runBackupUpkeep()

    // Assert — still the first run's one message per recipient.
    expect(await database.backupAlertRecipients(BACKUP_UNDELIVERED_TEMPLATE)).toHaveLength(BACKUP_ALERT_RECIPIENTS.length)
  })
})

test.describe('newest job made longer ago than the missing-backup alert threshold', () => {
  test.use({ backupJobSeed: STALE_BACKUP_JOB })

  test('BKP-SCHED-008 running the upkeep queues the missing-backup mail once to the shop and once to the developers', async ({ database, backupAlerts: _cleared, backupJob: _stale }) => {
    // Act
    await database.runBackupUpkeep()

    // Assert
    expect((await database.backupAlertRecipients(BACKUP_MISSING_TEMPLATE)).sort()).toEqual(BACKUP_ALERT_RECIPIENTS)
  })
})

// ── Start record ────────────────────────────────────────────────────────────
// No backup job is seeded, so a backup is due. The local and CI databases
// hold no GitHub token: a start that goes past every check answers
// `no_token`, which is how these cases tell "held back" from "went past".
// `backupSettings` is named to have the fixture write the shipped settings.

test.describe('backup due, a start still open', () => {
  test('BKP-SCHED-009 running the daily start reports a backup as already started', async ({ database, backupSettings: _shipped, backupDispatch: _open }) => {
    // Act
    const outcome = await database.startDueBackup()

    // Assert
    expect(outcome).toBe(START_ALREADY_STARTED_OUTCOME)
  })
})

test.describe('backup due, a start whose run reported a failure', () => {
  test.use({ backupDispatchSeed: FAILED_BACKUP_DISPATCH })

  test('BKP-SCHED-010 running the daily start goes past it to the GitHub token', async ({ database, backupSettings: _shipped, backupDispatch: _failed }) => {
    // Act
    const outcome = await database.startDueBackup()

    // Assert
    expect(outcome).toBe(START_NO_TOKEN_OUTCOME)
  })
})

test.describe('backup due, a start that never reported, sent longer ago than the wait for it', () => {
  test.use({ backupDispatchSeed: TIMED_OUT_BACKUP_DISPATCH })

  test('BKP-SCHED-011 running the daily start goes past it to the GitHub token', async ({ database, backupSettings: _shipped, backupDispatch: _timedOut }) => {
    // Act
    const outcome = await database.startDueBackup()

    // Assert
    expect(outcome).toBe(START_NO_TOKEN_OUTCOME)
  })
})
