import type { PaymentMethod } from '../../src/types/database'
import type { Database } from '../../src/types/supabase'
import type { FileSeedRow } from '../support/database'

type HistoryEvent = Database['public']['Enums']['history_event']

// What the record-protection pack writes against the guards: values that
// differ from what the seeds hold, so a refused write is told from a
// successful one by reading the row back.

/** The minutes of a time log on a product whose work is finished. */
export const LOCKED_TIME_LOG_MINUTES = 30

/** The one entry seeded onto a quote, standing for whatever history the record holds. */
export const QUOTE_HISTORY_EVENT: HistoryEvent = 'ORDER_CREATED'

/** The payment method a closed order would be switched to — the seeds are all INVOICE. */
export const OTHER_PAYMENT_METHOD: PaymentMethod = 'CASH'

/** A billing note written onto a closed order — the header field that stays free. */
export const CLOSED_ORDER_BILLING_NOTE = 'E2E billing note'

/** A production file linked to the released product of an in-progress order. */
export const RELEASED_PRODUCT_FILE: FileSeedRow = {
  display_name: 'E2E released product.pdf',
  path: '\\\\share\\e2e\\released.pdf',
  role: 'PRODUCTION_FILE',
}

/** A production file linked to the setup product of the same order. */
export const SETUP_PRODUCT_FILE: FileSeedRow = {
  display_name: 'E2E setup product.pdf',
  path: '\\\\share\\e2e\\setup.pdf',
  role: 'PRODUCTION_FILE',
}
