import type { OrderStatus } from '../types/database'

export type StatusMeta = {
  label: string
  color: string
  /** Hover shade of `color`, for solid interactive elements (e.g. the release button). */
  hoverColor: string
  /** Tinted focus/hover treatment of `color`, for light surfaces (e.g. menu items). */
  softHoverColor: string
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  QUOTE:            { label: 'Quote',         color: 'bg-gray-500',    hoverColor: 'hover:bg-gray-600',    softHoverColor: 'focus:bg-gray-500/10 focus:text-gray-700' },
  INCOMPLETE:       { label: 'In Setup',      color: 'bg-orange-500',  hoverColor: 'hover:bg-orange-600',  softHoverColor: 'focus:bg-orange-500/10 focus:text-orange-700' },
  PREPRESS_READY:   { label: 'In Prepress',   color: 'bg-pink-500',    hoverColor: 'hover:bg-pink-600',    softHoverColor: 'focus:bg-pink-500/10 focus:text-pink-700' },
  PRODUCTION_READY: { label: 'In Production', color: 'bg-blue-500',    hoverColor: 'hover:bg-blue-600',    softHoverColor: 'focus:bg-blue-500/10 focus:text-blue-700' },
  DONE:             { label: 'Done',          color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600', softHoverColor: 'focus:bg-emerald-500/10 focus:text-emerald-700' },
  INVOICED:         { label: 'Invoiced',      color: 'bg-yellow-500',  hoverColor: 'hover:bg-yellow-600',  softHoverColor: 'focus:bg-yellow-500/10 focus:text-yellow-700' },
}

/** Ordered workflow statuses shown in the job status track. */
export const WORKFLOW_STATUSES: OrderStatus[] = [
  'INCOMPLETE',
  'PREPRESS_READY',
  'PRODUCTION_READY',
  'DONE',
]
