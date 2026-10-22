import { supabase } from '../supabase'
import type { Tables, TablesUpdate } from '../types/supabase'

/** One mail type's row: its switches (on/off, the delay before the first send, the repeat interval, the most sends) and its wording. */
export type EmailSetting = Tables<'email_settings'>

/**
 * What a save changes: a switch, or the wording. The template names the row
 * and is never changed; the placeholders are the mail's, set by the migration
 * that adds it.
 */
export type EmailSettingPatch = Pick<
  TablesUpdate<'email_settings'>,
  'is_enabled' | 'delay_days' | 'repeat_days' | 'max_sends' | 'subject' | 'body'
>

const EMAIL_SETTING_COLUMNS = 'template, is_enabled, delay_days, repeat_days, max_sends, subject, body, placeholders'

/**
 * Settings → Emails (`email_settings`, one row per mail type). A row is added
 * by the migration of the feature that owns the mail, with its default
 * wording; the app only lists and edits what is there. Writes are admin-only
 * by RLS. `queue_email` reads `is_enabled` and `delay_days` when a mail is
 * queued, the sender reads `is_enabled`, `repeat_days`, `max_sends` and the
 * wording when it sends — so a changed delay reaches mail queued afterwards,
 * while switching a mail off and a changed wording reach mail already waiting
 * too. Wording is checked against the row's placeholders before it is saved
 * (`checkWording`); the database only refuses it blank.
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
