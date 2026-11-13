import type { Database } from '../../src/types/supabase'

type BackupSettingsRow = Database['public']['Tables']['backup_settings']['Row']

/** The backup runtime's settings, as the `backupSettings` fixture writes them before the test and again after it. */
export type BackupSettingsSeed = Omit<BackupSettingsRow, 'id' | 'updated_at'>

/** Every setting at the default its column ships with; the shop folder empty, as a fresh database has it. */
export const DEFAULT_BACKUP_SETTINGS: BackupSettingsSeed = {
  enabled: true,
  dump_interval_days: 7,
  start_wait_minutes: 120,
  lease_minutes: 30,
  reannounce_minutes: 30,
  holding_retention_days: 3,
  undelivered_alert_days: 2,
  missing_backup_alert_days: 8,
  weekly_retention_days: 90,
  monthly_retention_years: 10,
  share_server: null,
  share_name: null,
  share_folder: null,
}

/** The backup interval a test types in place of the default. */
export const EDITED_DUMP_INTERVAL_DAYS = 14

/** The shop folder retention a test types in place of the default. */
export const EDITED_WEEKLY_RETENTION_DAYS = 60

/** A weekly retention of ten years, so dumps made in March 2025 lie inside it. */
export const LONG_WEEKLY_RETENTION_BACKUP_SETTINGS: BackupSettingsSeed = {
  ...DEFAULT_BACKUP_SETTINGS,
  weekly_retention_days: 3650,
}

/** Backups switched off: nothing is started or announced, delivered copies are still purged. */
export const DISABLED_BACKUP_SETTINGS: BackupSettingsSeed = {
  ...DEFAULT_BACKUP_SETTINGS,
  enabled: false,
}

/** What the daily start reports when backups are switched off (`fn_start_due_backup`). */
export const START_DISABLED_OUTCOME = 'disabled'

/** What the daily start reports while a start it sent is still open. */
export const START_ALREADY_STARTED_OUTCOME = 'already_started'

/** What the daily start reports once it has gone past every other check to the GitHub token, which a local or CI database does not have. */
export const START_NO_TOKEN_OUTCOME = 'no_token'
