import type { Database } from '../../src/types/supabase'
import { BACKUP_SHA256 } from './backupJobs'

/** A start of the backup workflow as the database holds it (`backup_dispatches`). */
export type TestBackupDispatch = Database['public']['Tables']['backup_dispatches']['Row']

/**
 * One start, as the `backupDispatch` fixture inserts it with the runner's
 * connection — the row fn_start_due_backup, and the run's report since, would
 * have left. A recorded start gets a backup job of its own, linked onto it.
 */
export type BackupDispatchSeed = {
  /** Minutes back the start was sent. */
  requestedMinutesAgo: number
  /** Whether its run recorded a backup. */
  recorded: boolean
  /** Why its run reported a failure; null for none. */
  failure: string | null
}

/** Why the spec's failed run failed. */
export const RUN_FAILURE_REASON = 'The backup run failed'

/** A start sent ten minutes ago whose run has not reported: inside the shipped wait for a started backup (120 minutes). */
export const OPEN_BACKUP_DISPATCH: BackupDispatchSeed = {
  requestedMinutesAgo: 10,
  recorded: false,
  failure: null,
}

/** A start whose run recorded its backup. */
export const RECORDED_BACKUP_DISPATCH: BackupDispatchSeed = {
  ...OPEN_BACKUP_DISPATCH,
  recorded: true,
}

/** A start whose run reported a failure. */
export const FAILED_BACKUP_DISPATCH: BackupDispatchSeed = {
  ...OPEN_BACKUP_DISPATCH,
  failure: RUN_FAILURE_REASON,
}

/** A start sent three hours ago that never reported: past the shipped wait for a started backup. */
export const TIMED_OUT_BACKUP_DISPATCH: BackupDispatchSeed = {
  ...OPEN_BACKUP_DISPATCH,
  requestedMinutesAgo: 180,
}

/** What a run hands record_backup_job; the database helper gives each a storage path of its own. */
export type RecordedBackupSeed = { period: string; sizeBytes: number; sha256: string }

/** The backup a spec records for a start. */
export const RECORDED_BACKUP: RecordedBackupSeed = { period: '2026-W46', sizeBytes: 2048, sha256: BACKUP_SHA256 }
