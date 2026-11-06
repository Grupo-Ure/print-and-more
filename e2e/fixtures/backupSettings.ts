import type { Database } from '../../src/types/supabase'

type BackupSettingsRow = Database['public']['Tables']['backup_settings']['Row']

/** The backup runtime's settings, as the `backupSettings` fixture writes them before the test and again after it. */
export type BackupSettingsSeed = Omit<BackupSettingsRow, 'id' | 'updated_at'>

/** Every setting at the default its column ships with; the shop folder empty, as a fresh database has it. */
export const DEFAULT_BACKUP_SETTINGS: BackupSettingsSeed = {
  enabled: true,
  dump_interval_days: 7,
  lease_minutes: 30,
  reannounce_minutes: 30,
  holding_retention_days: 3,
  undelivered_alert_days: 2,
  missing_backup_alert_days: 8,
  share_server: null,
  share_name: null,
  share_folder: null,
}

/** The backup interval a test types in place of the default. */
export const EDITED_DUMP_INTERVAL_DAYS = 14

/** Backups switched off: nothing is started or announced, delivered copies are still purged. */
export const DISABLED_BACKUP_SETTINGS: BackupSettingsSeed = {
  ...DEFAULT_BACKUP_SETTINGS,
  enabled: false,
}

/** What the daily start reports when backups are switched off (`fn_start_due_backup`). */
export const START_DISABLED_OUTCOME = 'disabled'
