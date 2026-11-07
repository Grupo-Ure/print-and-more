import type { Database } from '../../src/types/supabase'

type BackupJobRow = Database['public']['Tables']['backup_jobs']['Row']

/** A backup job as the database holds it. */
export type TestBackupJob = BackupJobRow

/** The claim a seeded job carries: who holds it and how far its lease lies from now. */
export type BackupClaimSeed = {
  session: string
  machine: string
  /** Minutes from now the lease ends; negative for a lease that has passed. */
  leaseEndsInMinutes: number
}

/** Failed deliveries a seeded job has behind it. */
export type BackupFailureSeed = { attempts: number; lastError: string }

/**
 * One backup job, as the `backupJob` fixture inserts it with the runner's
 * connection — the row the dump workflow, and any claim, failure, delivery
 * and purge since, would have left. A job with a delivery is delivered, by
 * the machine of its claim; one with failures behind it is waiting again,
 * its last claim kept; one with a claim alone is taken; one with none of
 * these is waiting. The fixture gives each job a storage path of its own.
 */
export type BackupJobSeed = {
  period: string
  sizeBytes: number
  sha256: string
  /** Days back the dump was made; 0 for one just now. */
  createdDaysAgo: number
  claim: BackupClaimSeed | null
  failures: BackupFailureSeed | null
  delivered: boolean
  /** Days back the delivery lies; 0 for one just now. */
  deliveredDaysAgo: number
  purged: boolean
  /** Minutes back the roll was last called for it; 0 for the call its insert made. */
  announcedMinutesAgo: number
  /** Whether an object is put into the backups bucket at its path, as the workflow uploads one. */
  stored: boolean
}

/** The session id the spec's own running copy of the app claims and reports with. */
export const THIS_SESSION = '0b0b0b0b-0000-4000-8000-000000000001'

/** The session id of another running copy, on another machine. */
export const OTHER_SESSION = '0b0b0b0b-0000-4000-8000-000000000002'

export const THIS_MACHINE = 'E2E-THIS-PC'

export const OTHER_MACHINE = 'E2E-OTHER-PC'

/** The fingerprint every seeded job's file is recorded with. */
export const BACKUP_SHA256 = 'a'.repeat(64)

/** A fingerprint that matches no seeded job's file. */
export const WRONG_SHA256 = 'b'.repeat(64)

/** Why the spec's failed delivery failed. */
export const DELIVERY_FAILURE_REASON = 'Shop folder not reachable'

/** A dump waiting to be claimed. */
export const WAITING_BACKUP_JOB: BackupJobSeed = {
  period: '2026-W45',
  sizeBytes: 1024,
  sha256: BACKUP_SHA256,
  createdDaysAgo: 0,
  claim: null,
  failures: null,
  delivered: false,
  deliveredDaysAgo: 0,
  purged: false,
  announcedMinutesAgo: 0,
  stored: false,
}

/** A dump another copy took and did not finish: its lease ended an hour ago. */
export const LAPSED_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  claim: { session: OTHER_SESSION, machine: OTHER_MACHINE, leaseEndsInMinutes: -60 },
}

/** A dump the spec's own copy holds, its lease still running. */
export const HELD_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  claim: { session: THIS_SESSION, machine: THIS_MACHINE, leaseEndsInMinutes: 30 },
}

/** A dump waiting again after two deliveries failed. */
export const RETRIED_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  claim: { session: OTHER_SESSION, machine: OTHER_MACHINE, leaseEndsInMinutes: -60 },
  failures: { attempts: 2, lastError: DELIVERY_FAILURE_REASON },
}

/** A dump another copy is bringing to the shop folder right now. */
export const TAKEN_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  claim: { session: OTHER_SESSION, machine: OTHER_MACHINE, leaseEndsInMinutes: 30 },
}

/** A dump in the shop folder, its online copy still kept. */
export const DELIVERED_BACKUP_JOB: BackupJobSeed = {
  ...TAKEN_BACKUP_JOB,
  delivered: true,
}

/** A dump in the shop folder whose online copy the purge has deleted. */
export const PURGED_BACKUP_JOB: BackupJobSeed = {
  ...DELIVERED_BACKUP_JOB,
  purged: true,
}

/** The bytes a stored seed's object holds; never read, only deleted. */
export const BACKUP_FILE_CONTENT = 'e2e backup placeholder'

/** A dump delivered longer ago than the shipped holding retention (3 days), its online copy still in the bucket. */
export const DELIVERED_PAST_RETENTION_BACKUP_JOB: BackupJobSeed = {
  ...DELIVERED_BACKUP_JOB,
  deliveredDaysAgo: 4,
  stored: true,
}

/** A dump delivered a day ago, inside the shipped holding retention, its online copy in the bucket. */
export const DELIVERED_WITHIN_RETENTION_BACKUP_JOB: BackupJobSeed = {
  ...DELIVERED_BACKUP_JOB,
  deliveredDaysAgo: 1,
  stored: true,
}

/** A dump waiting since its roll was last called an hour ago, past the shipped re-announce interval (30 minutes). */
export const UNANSWERED_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  announcedMinutesAgo: 60,
}

/** A dump made three days ago and still waiting, past the shipped undelivered alert threshold (2 days). */
export const OVERDUE_BACKUP_JOB: BackupJobSeed = {
  ...WAITING_BACKUP_JOB,
  createdDaysAgo: 3,
}

/** A dump made and delivered nine days ago with none since, past the shipped missing-backup alert threshold (8 days). */
export const STALE_BACKUP_JOB: BackupJobSeed = {
  ...DELIVERED_BACKUP_JOB,
  createdDaysAgo: 9,
  deliveredDaysAgo: 9,
}
