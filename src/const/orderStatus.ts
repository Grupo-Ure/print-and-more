import type { JobStatus, OrderStatus } from '../types/database'

export type StatusMeta = {
  label: string
  color: string
  /** Hover shade of `color`, for solid interactive elements (e.g. the release button). */
  hoverColor: string
  /** Tinted focus/hover treatment of `color`, for light surfaces (e.g. menu items). */
  softHoverColor: string
  /** Same hue as `color` but as a text class, for inline mentions (e.g. history sentences). */
  textColor: string
}

/** Order lifecycle (manual transitions: QUOTE → IN_PROGRESS → FINISHED → BILLED). */
export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  QUOTE:       { label: 'Quote',       color: 'bg-gray-500',    hoverColor: 'hover:bg-gray-600',    softHoverColor: 'focus:bg-gray-500/10 focus:text-gray-700',       textColor: 'text-gray-600 dark:text-gray-400' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-orange-500',  hoverColor: 'hover:bg-orange-600',  softHoverColor: 'focus:bg-orange-500/10 focus:text-orange-700',   textColor: 'text-orange-600 dark:text-orange-400' },
  FINISHED:    { label: 'Finished',    color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600', softHoverColor: 'focus:bg-emerald-500/10 focus:text-emerald-700', textColor: 'text-emerald-600 dark:text-emerald-400' },
  BILLED:      { label: 'Billed',      color: 'bg-violet-500',  hoverColor: 'hover:bg-violet-600',  softHoverColor: 'focus:bg-violet-500/10 focus:text-violet-700',   textColor: 'text-violet-600 dark:text-violet-400' },
}

/** Job production workflow (IN_SETUP → PREPRESS → IN_PRODUCTION → DONE). */
export const JOB_STATUS_META: Record<JobStatus, StatusMeta> = {
  IN_SETUP:      { label: 'In Setup',      color: 'bg-orange-500',  hoverColor: 'hover:bg-orange-600',  softHoverColor: 'focus:bg-orange-500/10 focus:text-orange-700',   textColor: 'text-orange-600 dark:text-orange-400' },
  PREPRESS:      { label: 'Prepress',      color: 'bg-pink-500',    hoverColor: 'hover:bg-pink-600',    softHoverColor: 'focus:bg-pink-500/10 focus:text-pink-700',       textColor: 'text-pink-600 dark:text-pink-400' },
  IN_PRODUCTION: { label: 'In Production', color: 'bg-blue-500',    hoverColor: 'hover:bg-blue-600',    softHoverColor: 'focus:bg-blue-500/10 focus:text-blue-700',       textColor: 'text-blue-600 dark:text-blue-400' },
  DONE:          { label: 'Done',          color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600', softHoverColor: 'focus:bg-emerald-500/10 focus:text-emerald-700', textColor: 'text-emerald-600 dark:text-emerald-400' },
}

/** Ordered job statuses shown in the job status track. */
export const WORKFLOW_STATUSES: JobStatus[] = [
  'IN_SETUP',
  'PREPRESS',
  'IN_PRODUCTION',
  'DONE',
]
