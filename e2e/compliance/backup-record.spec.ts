import {
  DELIVERY_FAILURE_REASON,
  HELD_BACKUP_JOB,
  LAPSED_BACKUP_JOB,
  OTHER_MACHINE,
  OTHER_SESSION,
  THIS_MACHINE,
  THIS_SESSION,
  WRONG_SHA256,
} from '../fixtures/backupJobs'
import { RECORDED_BACKUP, RECORDED_BACKUP_DISPATCH, RUN_FAILURE_REASON } from '../fixtures/backupDispatches'
import { expect, test } from '../fixtures/orders'
import { TEST_USERS } from '../fixtures/users'

// Driven against the database, no screen involved, like CMP-LOCK: a signed-in
// admin calls the functions every running copy of the app calls, and the
// outcome is read back through the runner's connection. The functions of
// 20261106104329_backup_jobs are the subject; the `backupJob` fixture inserts
// the job as the dump workflow, and any claim since, would have left it.

test.describe('as admin, waiting job', () => {
  test('BKP-REC-001 claiming a waiting job returns it and stamps the lease', async ({ database, backupJob }) => {
    // Setup — a connection that calls as the admin, not as the runner.
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { data } = await asAdmin.rpc('claim_backup_job', {
      job_id: backupJob.id,
      session_id: THIS_SESSION,
      machine: THIS_MACHINE,
    })

    // Assert — the job came back, and the stored claim is this session's with a lease still to run.
    expect(data?.map(job => job.id)).toEqual([backupJob.id])
    const stored = await database.backupJob(backupJob.id)
    expect(stored.claimed_by_session).toBe(THIS_SESSION)
    expect(Date.parse(stored.lease_until ?? '')).toBeGreaterThan(Date.now())
  })

  test('BKP-REC-002 claiming a job another session just claimed returns nothing', async ({ database, backupJob }) => {
    // Setup — the other copy claims the job first.
    const asAdmin = await database.asUser(TEST_USERS.admin)
    await asAdmin.rpc('claim_backup_job', { job_id: backupJob.id, session_id: OTHER_SESSION, machine: OTHER_MACHINE })

    // Act
    const { data, error } = await asAdmin.rpc('claim_backup_job', {
      job_id: backupJob.id,
      session_id: THIS_SESSION,
      machine: THIS_MACHINE,
    })

    // Assert — no error and no row: the other copy holds it.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

test.describe('as admin, job taken by another session, lease passed', () => {
  test.use({ backupJobSeed: LAPSED_BACKUP_JOB })

  test('BKP-REC-003 claiming a taken job whose lease has passed returns it', async ({ database, backupJob }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { data } = await asAdmin.rpc('claim_backup_job', {
      job_id: backupJob.id,
      session_id: THIS_SESSION,
      machine: THIS_MACHINE,
    })

    // Assert
    expect(data?.map(job => job.id)).toEqual([backupJob.id])
  })
})

test.describe('as admin, job held by this session', () => {
  test.use({ backupJobSeed: HELD_BACKUP_JOB })

  test('BKP-REC-004 reporting a delivery with the wrong fingerprint is refused', async ({ database, backupJob }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    const { error } = await asAdmin.rpc('report_backup_delivered', {
      job_id: backupJob.id,
      session_id: THIS_SESSION,
      sha256: WRONG_SHA256,
    })

    // Assert — refused, and the job still taken.
    expect(error).not.toBeNull()
    expect((await database.backupJob(backupJob.id)).state).toBe('TAKEN')
  })

  test('BKP-REC-005 reporting a failed delivery puts the job back with the attempt counted and the reason kept', async ({ database, backupJob }) => {
    // Setup
    const asAdmin = await database.asUser(TEST_USERS.admin)

    // Act
    await asAdmin.rpc('report_backup_failed', {
      job_id: backupJob.id,
      session_id: THIS_SESSION,
      reason: DELIVERY_FAILURE_REASON,
    })

    // Assert
    expect(await database.backupJob(backupJob.id)).toMatchObject({
      state: 'WAITING',
      attempts: 1,
      last_error: DELIVERY_FAILURE_REASON,
    })
  })
})

// ── The start a run belongs to ──────────────────────────────────────────────
// The dump workflow's own calls, made with the service role through the
// runner's connection; the `backupDispatch` fixture inserts the start as
// fn_start_due_backup, and the run's report since, would have left it.

test.describe('start still open', () => {
  test("BKP-REC-006 recording a backup with the start's id links the backup onto the start", async ({ database, backupDispatch }) => {
    // Act
    const recorded = await database.recordBackupJob(backupDispatch.id, RECORDED_BACKUP)

    // Assert
    expect((await database.backupDispatch(backupDispatch.id)).job_id).toBe(recorded.id)
  })

  test('BKP-REC-007 reporting the run as failed stamps the start with the reason', async ({ database, backupDispatch }) => {
    // Act
    await database.reportBackupDispatchFailed(backupDispatch.id, RUN_FAILURE_REASON)

    // Assert
    const stored = await database.backupDispatch(backupDispatch.id)
    expect(stored.failed_at).not.toBeNull()
    expect(stored.error).toBe(RUN_FAILURE_REASON)
  })
})

test.describe('start whose run already recorded a backup', () => {
  test.use({ backupDispatchSeed: RECORDED_BACKUP_DISPATCH })

  test("BKP-REC-008 recording another backup with the start's id records it and leaves the start's backup as it was", async ({ database, backupDispatch }) => {
    // Act
    const recorded = await database.recordBackupJob(backupDispatch.id, RECORDED_BACKUP)

    // Assert — the backup is on record; the start still names the first one.
    expect((await database.backupJob(recorded.id)).id).toBe(recorded.id)
    expect((await database.backupDispatch(backupDispatch.id)).job_id).toBe(backupDispatch.job_id)
  })

  test('BKP-REC-009 reporting the run as failed is refused', async ({ database, backupDispatch }) => {
    // Act
    const { error } = await database.reportBackupDispatchFailed(backupDispatch.id, RUN_FAILURE_REASON)

    // Assert
    expect(error).not.toBeNull()
  })
})
