import type { OrderStatus } from '../types/database'

export type StatusMeta = {
  label: string
  color: string
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  QUOTE:            { label: 'Quote',         color: 'bg-gray-500' },
  INCOMPLETE:       { label: 'In Setup',      color: 'bg-orange-500' },
  PREPRESS_READY:   { label: 'In Prepress',   color: 'bg-pink-500' },
  PRODUCTION_READY: { label: 'In Production', color: 'bg-blue-500' },
  DONE:             { label: 'Done',          color: 'bg-emerald-500' },
  INVOICED:         { label: 'Invoiced',      color: 'bg-yellow-500' },
}

/** Ordered workflow statuses shown in the job status track. */
export const WORKFLOW_STATUSES: OrderStatus[] = [
  'INCOMPLETE',
  'PREPRESS_READY',
  'PRODUCTION_READY',
  'DONE',
]
