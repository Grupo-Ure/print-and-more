import type { PaymentMethod } from '../../src/types/database'
import type { Database } from '../../src/types/supabase'
import type { FileSeedRow } from '../support/database'
import { FULL_CUSTOMER } from './customers'

type HistoryEvent = Database['public']['Enums']['history_event']

// What the record-protection pack writes against the guards: values that
// differ from what the seeds hold, so a refused write is told from a
// successful one by reading the row back.

/** The minutes of a time log on a product whose work is finished. */
export const LOCKED_TIME_LOG_MINUTES = 30

/** The one entry seeded onto a quote, standing for whatever history the record holds. */
export const QUOTE_HISTORY_EVENT: HistoryEvent = 'ORDER_CREATED'

/** The minutes of a time log on a product still open. */
export const OPEN_TIME_LOG_MINUTES = 15

/** An event a fresh quote holds no entry of — what an app login would try to write into the history itself. */
export const DIRECT_HISTORY_EVENT: HistoryEvent = 'ORDER_ARCHIVED'

/** The entry the database writes for each changed field of a customer. */
export const CUSTOMER_UPDATED_HISTORY_EVENT: HistoryEvent = 'CUSTOMER_UPDATED'

/** The entry the database writes for a file linked to an order, and again for its link to a product. */
export const FILE_ADDED_HISTORY_EVENT: HistoryEvent = 'FILE_ADDED'

/** The entry the database writes for a time log. */
export const TIME_LOGGED_HISTORY_EVENT: HistoryEvent = 'TIME_LOGGED'

/** The entry a release writes for each stock item it deducts from. */
export const STOCK_DEDUCTED_HISTORY_EVENT: HistoryEvent = 'STOCK_AUTO_DEDUCTED'

/** Two fields of a customer changed in one write — both differ from what TEST_CUSTOMER holds. */
export const CUSTOMER_CHANGE = {
  name: 'E2E Customer, renamed',
  phone: FULL_CUSTOMER.phone,
} as const

/** What the database records of `CUSTOMER_CHANGE`: one entry per field, with its new value, in field order. */
export const CUSTOMER_CHANGE_ENTRIES = [
  { field: 'name', next: CUSTOMER_CHANGE.name },
  { field: 'phone', next: CUSTOMER_CHANGE.phone },
] as const

/** Postgres' error code for a delete a foreign key restricts. */
export const FOREIGN_KEY_VIOLATION = '23503'

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
