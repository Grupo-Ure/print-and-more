import { supabase } from '../supabase'
import type { Tables, TablesUpdate } from '../types/supabase'

/** The backup runtime's settings: the one row of `backup_settings`. */
export type BackupSettings = Tables<'backup_settings'>

/** The settings a save changes; `id` names the one row and `updated_at` is the database's. */
export type BackupSettingsPatch = Omit<TablesUpdate<'backup_settings'>, 'id' | 'updated_at'>

// One literal, not a concatenation: supabase-js types the row from the string.
const BACKUP_SETTINGS_COLUMNS =
  'id, enabled, dump_interval_days, lease_minutes, reannounce_minutes, holding_retention_days, undelivered_alert_days, missing_backup_alert_days, weekly_retention_days, monthly_retention_years, share_server, share_name, share_folder, updated_at'

/**
 * Settings → Backups (`backup_settings`). The table holds exactly one row,
 * inserted by its migration; the app reads it and updates columns of it.
 * Updates are admin-only by RLS.
 */
class BackupSettingsService {
  async get(): Promise<BackupSettings> {
    const { data, error } = await supabase.from('backup_settings').select(BACKUP_SETTINGS_COLUMNS).single()
    if (error) throw error
    return data
  }

  /** Returns the row as stored; fails when RLS let nothing through rather than updating no row silently. */
  async update(patch: BackupSettingsPatch): Promise<BackupSettings> {
    const { data, error } = await supabase
      .from('backup_settings')
      .update(patch)
      .eq('id', true)
      .select(BACKUP_SETTINGS_COLUMNS)
      .single()
    if (error) throw error
    return data
  }
}

export const backupSettingsService = new BackupSettingsService()
