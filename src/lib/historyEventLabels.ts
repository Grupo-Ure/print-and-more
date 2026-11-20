import type { Database } from '../types/supabase'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * A short name per history event, for picking one (the event filter of the
 * order's History tab and of the History page). The entries themselves read as
 * sentences, built in `historySentences`.
 */
export const HISTORY_EVENT_LABELS: Record<HistoryEvent, string> = {
  ORDER_CREATED: 'Order created',
  PROCESSING_STARTED: 'Processing started',
  PREPRESS_READY: 'Moved to pre-press',
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
  ORDER_BILLING_NOTE_CHANGED: 'Billing note changed',
  TIME_LOGGED: 'Time logged',
  TIME_LOG_DELETED: 'Time log deleted',
  SETTINGS_CHANGED: 'Settings changed',
  PRODUCT_CREATED: 'Product added',
  PRODUCT_UPDATED: 'Product updated',
  PRODUCT_CANCELLED: 'Product cancelled',
  PRODUCT_DELETED: 'Product deleted',
  RETURNED_TO_PREPRESS: 'Returned to pre-press',
  FILE_ADDED: 'File added',
  FILE_RENAMED: 'File renamed',
  FILE_ROLE_CHANGED: 'File role changed',
  FILE_REMOVED: 'File removed',
  CUSTOMER_CREATED: 'Customer created',
  CUSTOMER_UPDATED: 'Customer updated',
  STOCK_BOOKED: 'Stock booked',
  STOCK_AUTO_DEDUCTED: 'Stock deducted automatically',
  EMAIL_SENT: 'Email sent',
  EMAIL_FAILED: 'Email failed',
  EMAIL_BOUNCED: 'Email bounced',
}
