import type { Database } from '../../src/types/supabase'

type CustomerApprovalSettingsRow = Database['public']['Tables']['customer_approval_settings']['Row']

/** The customer approval's settings, as the `customerApprovalSettings` fixture writes them before the test and again after it. */
export type CustomerApprovalSettingsSeed = Omit<CustomerApprovalSettingsRow, 'id' | 'updated_at'>

/** Both settings at the default their columns ship with. */
export const DEFAULT_CUSTOMER_APPROVAL_SETTINGS: CustomerApprovalSettingsSeed = {
  expiry_days: 14,
  retention_days: 1095,
}

/** The validity a test types in place of the default. */
export const EDITED_EXPIRY_DAYS = 30

/** The retention a test types in place of the default. */
export const EDITED_RETENTION_DAYS = 365
