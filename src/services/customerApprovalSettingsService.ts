import { supabase } from '../supabase'
import type { Tables, TablesUpdate } from '../types/supabase'

/** The customer approval's settings: the one row of `customer_approval_settings`. */
export type CustomerApprovalSettings = Tables<'customer_approval_settings'>

/** The settings a save changes; `id` names the one row and `updated_at` is the database's. */
export type CustomerApprovalSettingsPatch = Omit<TablesUpdate<'customer_approval_settings'>, 'id' | 'updated_at'>

const CUSTOMER_APPROVAL_SETTINGS_COLUMNS = 'id, expiry_days, retention_days, updated_at'

/**
 * Settings → Customer approval (`customer_approval_settings`). The table
 * holds exactly one row, inserted by its migration; the app reads it and
 * updates columns of it. Updates are admin-only by RLS.
 */
class CustomerApprovalSettingsService {
  async get(): Promise<CustomerApprovalSettings> {
    const { data, error } = await supabase
      .from('customer_approval_settings')
      .select(CUSTOMER_APPROVAL_SETTINGS_COLUMNS)
      .single()
    if (error) throw error
    return data
  }

  /** Returns the row as stored; fails when RLS let nothing through rather than updating no row silently. */
  async update(patch: CustomerApprovalSettingsPatch): Promise<CustomerApprovalSettings> {
    const { data, error } = await supabase
      .from('customer_approval_settings')
      .update(patch)
      .eq('id', true)
      .select(CUSTOMER_APPROVAL_SETTINGS_COLUMNS)
      .single()
    if (error) throw error
    return data
  }
}

export const customerApprovalSettingsService = new CustomerApprovalSettingsService()
