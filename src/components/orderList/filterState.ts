import { SUB_ORDER_DEPARTMENTS, type OrderStatus } from '../../types/database'

export const STATUS_ORDER: OrderStatus[] = [
  'QUOTE',
  'INCOMPLETE',
  'PREPRESS_READY',
  'PRODUCTION_READY',
  'DONE',
  'INVOICED',
]

export const DEFAULT_STATUS_TOGGLES: Record<OrderStatus, boolean> = {
  QUOTE: true,
  INCOMPLETE: true,
  PREPRESS_READY: true,
  PRODUCTION_READY: true,
  DONE: false,
  INVOICED: false,
}

/** Short label for the status filter checkboxes. */
export const STATUS_CHECKBOX_SHORT: Record<OrderStatus, string> = {
  QUOTE: 'Quote',
  INCOMPLETE: 'Incomplete',
  PREPRESS_READY: 'PrePress',
  PRODUCTION_READY: 'In Prod.',
  DONE: 'Done',
  INVOICED: 'Invoiced',
}

export function defaultFilterState() {
  return {
    searchInput: '',
    searchDebounced: '',
    statusAll: false,
    statusToggles: { ...DEFAULT_STATUS_TOGGLES },
    deadlineFrom: '',
    deadlineTo: '',
    intakeFrom: '',
    intakeTo: '',
    department: 'All' as 'All' | (typeof SUB_ORDER_DEPARTMENTS)[number],
  }
}

export type FilterState = ReturnType<typeof defaultFilterState>

export function statusTogglesToIn(toggles: Record<OrderStatus, boolean>): OrderStatus[] {
  return (Object.entries(toggles) as [OrderStatus, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([status]) => status)
}

const VALID_ORDER_STATUSES = new Set<string>(STATUS_ORDER)

/** Only values from the fixed status list — prevents PostgREST `.in('status', …)` type assertions. */
export function filterValidOrderStatuses(values: readonly OrderStatus[]): OrderStatus[] {
  return values.filter((status): status is OrderStatus => VALID_ORDER_STATUSES.has(status))
}

export function isFilterActive(filterState: FilterState): boolean {
  const defaultState = defaultFilterState()
  if (filterState.searchInput.trim() !== '' || filterState.searchDebounced.trim() !== '') return true
  if (filterState.deadlineFrom || filterState.deadlineTo || filterState.intakeFrom || filterState.intakeTo) return true
  if (filterState.department !== 'All') return true
  if (filterState.statusAll !== defaultState.statusAll) return true
  for (const status of STATUS_ORDER) {
    if (filterState.statusToggles[status] !== defaultState.statusToggles[status]) return true
  }
  return false
}

export function statusBadgeClass(s: OrderStatus): string {
  switch (s) {
    case 'QUOTE':
      return 'badge-grau'
    case 'INCOMPLETE':
      return 'badge-orange'
    case 'PREPRESS_READY':
      return 'badge-blau'
    case 'PRODUCTION_READY':
      return 'badge-lila'
    case 'DONE':
      return 'badge-gruen'
    default:
      return 'badge-grau'
  }
}

export function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    QUOTE: 'Quote',
    INCOMPLETE: 'Incomplete',
    PREPRESS_READY: 'PrePress',
    PRODUCTION_READY: 'In Production',
    DONE: 'Done',
    INVOICED: 'Invoiced',
  }
  return labels[status] ?? status
}
