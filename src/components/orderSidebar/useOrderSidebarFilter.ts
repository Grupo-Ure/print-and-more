import { useEffect, useMemo, useState } from 'react'
import { ORDER_STATUS_LIST, type Department, type OrderStatus } from '../../types/database'
import type { AssigneeFilterValue } from '../../lib/orderFilters'

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
  /** Empty = every department. */
  departments: Department[]
  deadlineFrom: string
  deadlineTo: string
  intakeFrom: string
  intakeTo: string
  /** Empty = every assignee. */
  assigneeIds: AssigneeFilterValue[]
  /** Off = non-archived orders plus billed ones; on = archived orders too. */
  showArchived: boolean
}

function defaultFilterState(): FilterState {
  return {
    searchInput: '',
    searchDebounced: '',
    statusAll: false,
    statusToggles: { ...DEFAULT_STATUS_TOGGLES },
    departments: [],
    deadlineFrom: '',
    deadlineTo: '',
    intakeFrom: '',
    intakeTo: '',
    assigneeIds: [],
    showArchived: false,
  }
}

export function isStatusFilterActive(state: FilterState): boolean {
  const defaults = defaultFilterState()
  if (state.statusAll !== defaults.statusAll) return true
  return ORDER_STATUS_LIST.some(status => state.statusToggles[status] !== defaults.statusToggles[status])
}

export function isDepartmentFilterActive(state: FilterState): boolean {
  return state.departments.length > 0
}

export function isDeadlineFilterActive(state: FilterState): boolean {
  return !!(state.deadlineFrom || state.deadlineTo || state.intakeFrom || state.intakeTo)
}

export function isUsersFilterActive(state: FilterState): boolean {
  return state.assigneeIds.length > 0
}

export type FilterActions = {
  setSearchInput: (value: string) => void
  clearSearch: () => void
  setStatusAll: (value: boolean) => void
  toggleStatus: (status: OrderStatus, checked: boolean) => void
  resetStatus: () => void
  toggleDepartment: (department: Department, checked: boolean) => void
  resetDepartments: () => void
  setDeadlineFrom: (value: string) => void
  setDeadlineTo: (value: string) => void
  setIntakeFrom: (value: string) => void
  setIntakeTo: (value: string) => void
  resetDeadline: () => void
  toggleAssignee: (value: AssigneeFilterValue, checked: boolean) => void
  resetAssignees: () => void
  setShowArchived: (value: boolean) => void
}

function toggled<T>(list: T[], value: T, checked: boolean): T[] {
  if (checked) return list.includes(value) ? list : [...list, value]
  return list.filter(item => item !== value)
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
    resetStatus: () => {
      const defaults = defaultFilterState()
      setFilter(f => ({ ...f, statusAll: defaults.statusAll, statusToggles: defaults.statusToggles }))
    },
    toggleDepartment: (department, checked) =>
      setFilter(f => ({ ...f, departments: toggled(f.departments, department, checked) })),
    resetDepartments: () => setFilter(f => ({ ...f, departments: [] })),
    setDeadlineFrom: value => setFilter(f => ({ ...f, deadlineFrom: value })),
    setDeadlineTo: value => setFilter(f => ({ ...f, deadlineTo: value })),
    setIntakeFrom: value => setFilter(f => ({ ...f, intakeFrom: value })),
    setIntakeTo: value => setFilter(f => ({ ...f, intakeTo: value })),
    resetDeadline: () =>
      setFilter(f => ({ ...f, deadlineFrom: '', deadlineTo: '', intakeFrom: '', intakeTo: '' })),
    toggleAssignee: (value, checked) =>
      setFilter(f => ({ ...f, assigneeIds: toggled(f.assigneeIds, value, checked) })),
    resetAssignees: () => setFilter(f => ({ ...f, assigneeIds: [] })),
    setShowArchived: value => setFilter(f => ({ ...f, showArchived: value })),
  }), [])

  const selectedStatuses = useMemo<OrderStatus[]>(
    () => ORDER_STATUS_LIST.filter(status => filter.statusToggles[status]),
    [filter.statusToggles],
  )

  const hasStatusFilter = filter.statusAll || selectedStatuses.length > 0

  return {
    filter,
    selectedStatuses,
    hasStatusFilter,
    actions,
  }
}
