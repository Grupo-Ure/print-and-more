import { useEffect, useMemo, useState } from 'react'
import { DEPARTMENTS, type OrderStatus } from '../../types/database'

export const STATUS_ORDER: OrderStatus[] = [
  'QUOTE',
  'IN_PROGRESS',
  'FINISHED',
  'BILLED',
]

const DEFAULT_STATUS_TOGGLES: Record<OrderStatus, boolean> = {
  QUOTE: true,
  IN_PROGRESS: true,
  FINISHED: false,
  BILLED: false,
}

export type FilterState = {
  searchInput: string
  searchDebounced: string
  statusAll: boolean
  statusToggles: Record<OrderStatus, boolean>
  deadlineFrom: string
  deadlineTo: string
  intakeFrom: string
  intakeTo: string
  department: 'All' | (typeof DEPARTMENTS)[number]
}

function defaultFilterState(): FilterState {
  return {
    searchInput: '',
    searchDebounced: '',
    statusAll: false,
    statusToggles: { ...DEFAULT_STATUS_TOGGLES },
    deadlineFrom: '',
    deadlineTo: '',
    intakeFrom: '',
    intakeTo: '',
    department: 'All',
  }
}

const VALID_ORDER_STATUSES = new Set<string>(STATUS_ORDER)

function dirtyAgainstDefaults(state: FilterState): boolean {
  const defaults = defaultFilterState()
  if (state.searchInput.trim() !== '' || state.searchDebounced.trim() !== '') return true
  if (state.deadlineFrom || state.deadlineTo || state.intakeFrom || state.intakeTo) return true
  if (state.department !== 'All') return true
  if (state.statusAll !== defaults.statusAll) return true
  for (const status of STATUS_ORDER) {
    if (state.statusToggles[status] !== defaults.statusToggles[status]) return true
  }
  return false
}

export type FilterActions = {
  setSearchInput: (value: string) => void
  clearSearch: () => void
  setStatusAll: (value: boolean) => void
  toggleStatus: (status: OrderStatus, checked: boolean) => void
  setDepartment: (value: FilterState['department']) => void
  setDeadlineFrom: (value: string) => void
  setDeadlineTo: (value: string) => void
  setIntakeFrom: (value: string) => void
  setIntakeTo: (value: string) => void
  reset: () => void
}

export function useOrderSidebarFilter() {
  const [filter, setFilter] = useState<FilterState>(defaultFilterState)

  // 300ms debounce: mirror searchInput → searchDebounced.
  const searchInput = filter.searchInput
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilter(f => (f.searchInput === searchInput ? { ...f, searchDebounced: searchInput } : f))
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const actions = useMemo<FilterActions>(() => ({
    setSearchInput: value => setFilter(f => ({ ...f, searchInput: value })),
    clearSearch: () => setFilter(f => ({ ...f, searchInput: '', searchDebounced: '' })),
    setStatusAll: value => setFilter(f => ({ ...f, statusAll: value })),
    toggleStatus: (status, checked) =>
      setFilter(f => ({
        ...f,
        statusAll: false,
        statusToggles: { ...f.statusToggles, [status]: checked },
      })),
    setDepartment: value => setFilter(f => ({ ...f, department: value })),
    setDeadlineFrom: value => setFilter(f => ({ ...f, deadlineFrom: value })),
    setDeadlineTo: value => setFilter(f => ({ ...f, deadlineTo: value })),
    setIntakeFrom: value => setFilter(f => ({ ...f, intakeFrom: value })),
    setIntakeTo: value => setFilter(f => ({ ...f, intakeTo: value })),
    reset: () => setFilter(defaultFilterState()),
  }), [])

  const selectedStatuses = useMemo<OrderStatus[]>(
    () =>
      (Object.entries(filter.statusToggles) as [OrderStatus, boolean][])
        .filter(([, enabled]) => enabled)
        .map(([status]) => status)
        .filter((status): status is OrderStatus => VALID_ORDER_STATUSES.has(status)),
    [filter.statusToggles],
  )

  const hasStatusFilter = filter.statusAll || selectedStatuses.length > 0
  const isActive = dirtyAgainstDefaults(filter)

  return {
    filter,
    isActive,
    selectedStatuses,
    hasStatusFilter,
    actions,
  }
}
