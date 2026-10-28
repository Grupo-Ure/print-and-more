import type { Database } from '../types/supabase'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * A short name per history event, for picking one (the History tab's event
 * filter). The entries themselves read as sentences, built in `OrderHistory`.
 */
export const HISTORY_EVENT_LABELS: Record<HistoryEvent, string> = {
  ORDER_CREATED: 'Order created',
  PROCESSING_STARTED: 'Processing started',
  PREPRESS_READY_AUTO: 'Pre-press (automatic)',
  PREPRESS_READY_MANUAL: 'Released to pre-press',
  PRODUCTION_READY_SET: 'Released to production',
  MARKED_DONE: 'Marked done',
  EMERGENCY_TRIGGERED: 'Force release',
  CUSTOMER_APPROVAL_ACTIVATED: 'Approval required',
  CUSTOMER_APPROVAL_DEACTIVATED: 'Approval requirement removed',
  CUSTOMER_APPROVAL_REQUESTED: 'Approval requested',
  CUSTOMER_APPROVAL_GRANTED: 'Approval granted',
  CUSTOMER_APPROVAL_CHANGES_REQUESTED: 'Changes requested',
  CUSTOMER_APPROVAL_WITHDRAWN: 'Approval withdrawn',
  CUSTOMER_APPROVAL_EXPIRED: 'Approval expired',
  CUSTOMER_APPROVAL_BYPASSED: 'Approval bypassed',
  ROLLED_BACK: 'Moved back to setup',
  CANCELLED: 'Order cancelled',
  ERP_EXPORTED: 'ERP export',
  ASSIGNEE_CHANGED: 'Assignee changed',
  ORDER_FINISHED: 'Order finished',
  ORDER_REOPENED: 'Order reopened',
  ORDER_BILLED: 'Order billed',
  ORDER_CLOSED_CASH: 'Closed (paid in cash)',
  ORDER_ARCHIVED: 'Order archived',
  TIME_LOGGED: 'Time logged',
  TIME_LOG_DELETED: 'Time log deleted',
  SETTINGS_CHANGED: 'Settings changed',
  PRODUCT_CREATED: 'Product added',
  PRODUCT_UPDATED: 'Product updated',
  PRODUCT_CANCELLED: 'Product cancelled',
  PRODUCT_DELETED: 'Product deleted',
  FILE_ADDED: 'File added',
  FILE_REMOVED: 'File removed',
  EMAIL_SENT: 'Email sent',
  EMAIL_FAILED: 'Email failed',
  EMAIL_BOUNCED: 'Email bounced',
}
