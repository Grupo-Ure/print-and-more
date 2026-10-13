import { supabase } from '../supabase'
import type { Tables, TablesUpdate } from '../types/supabase'

/** One template's switches: on/off, the delay before the first send, the repeat interval, the most sends. */
export type EmailSetting = Tables<'email_settings'>

/** The switches a save changes; the template names the row and is never changed. */
export type EmailSettingPatch = Pick<TablesUpdate<'email_settings'>, 'is_enabled' | 'delay_days' | 'repeat_days' | 'max_sends'>

const EMAIL_SETTING_COLUMNS = 'template, is_enabled, delay_days, repeat_days, max_sends'

/**
 * Settings → Emails (`email_settings`, one row per delayed or repeating
 * template). A row is added by the migration of the feature that owns the
 * template; the app only lists and edits what is there. Writes are admin-only
 * by RLS. `queue_email` reads `is_enabled` and `delay_days` when a mail is
 * queued, the sender reads `is_enabled`, `repeat_days` and `max_sends` when it
 * sends — so a change reaches mail queued afterwards, not mail already waiting
 * (except switching it off, which the sender also honours).
 */
class EmailSettingsService {
  async list(): Promise<EmailSetting[]> {
    const { data, error } = await supabase
      .from('email_settings')
      .select(EMAIL_SETTING_COLUMNS)
      .order('template')
    if (error) throw error
    return data ?? []
  }

  /** Returns the row as stored; fails when RLS let nothing through rather than updating no row silently. */
  async update(template: string, patch: EmailSettingPatch): Promise<EmailSetting> {
    const { data, error } = await supabase
      .from('email_settings')
      .update(patch)
      .eq('template', template)
      .select(EMAIL_SETTING_COLUMNS)
      .single()
    if (error) throw error
    return data
  }
}

export const emailSettingsService = new EmailSettingsService()
