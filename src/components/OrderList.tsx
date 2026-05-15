import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { customerService } from '../services/customerService'
import { orderService, type OrderListEntry } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { formatDateDe } from '../lib/formatDate'
import { customerName } from '../lib/customer'
import {
  SUB_ORDER_DEPARTMENTS,
  type Auftrag,
  type OrderStatus,
  type SubOrderRow,
} from '../types/database'
import { SUB_ORDER_DEPARTMENT_LABELS } from '../const/departmentAbbreviation'
import { DateInput } from './DateInput'
import { DuplicateDialog } from './DuplicateDialog'
import { useToast } from './Toast'
import './OrderList.css'

type OrderInPlace = { tick: number; id: string; status: OrderStatus }

type Props = {
  orderInPlace: OrderInPlace
  activeOrderId: string | null
  onSelectOrder: (id: string) => void
  onNewOrder: () => void
}

const STATUS_ORDER: OrderStatus[] = [
  'QUOTE',
  'INCOMPLETE',
  'PREPRESS_READY',
  'PRODUCTION_READY',
  'DONE',
  'INVOICED',
]

const DEFAULT_STATUS_TOGGLES: Record<OrderStatus, boolean> = {
  QUOTE: true,
  INCOMPLETE: true,
  PREPRESS_READY: true,
  PRODUCTION_READY: true,
  DONE: false,
  INVOICED: false,
}

/** Short label for the status filter checkboxes. */
const STATUS_CHECKBOX_SHORT: Record<OrderStatus, string> = {
  QUOTE: 'Quote',
  INCOMPLETE: 'Incomplete',
  PREPRESS_READY: 'PrePress',
  PRODUCTION_READY: 'In Prod.',
  DONE: 'Done',
  INVOICED: 'Invoiced',
}


function defaultFilterState() {
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

type FilterState = ReturnType<typeof defaultFilterState>

function statusTogglesToIn(toggles: Record<OrderStatus, boolean>): OrderStatus[] {
  return (Object.entries(toggles) as [OrderStatus, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([status]) => status)
}

const VALID_ORDER_STATUSES = new Set<string>(STATUS_ORDER)

/** Only values from the fixed status list — prevents PostgREST `.in('status', …)` type assertions. */
function filterValidOrderStatuses(values: readonly OrderStatus[]): OrderStatus[] {
  return values.filter((status): status is OrderStatus => VALID_ORDER_STATUSES.has(status))
}

function isFilterActive(filterState: FilterState): boolean {
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

function statusBadgeClass(s: OrderStatus): string {
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

function statusLabel(status: OrderStatus): string {
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

export function OrderList({ orderInPlace, activeOrderId, onSelectOrder, onNewOrder }: Props) {
  const [filter, setFilter] = useState<FilterState>(() => defaultFilterState())
  const { searchInput, searchDebounced, statusAll, statusToggles, deadlineFrom, deadlineTo, intakeFrom, intakeTo, department } =
    filter
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterPopOpen, setFilterPopOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilter(f => (f.searchInput === searchInput ? { ...f, searchDebounced: searchInput } : f))
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const setSearchInput = (value: string) => setFilter(f => ({ ...f, searchInput: value }))

  const clearSearch = () => {
    setFilter(f => ({ ...f, searchInput: '', searchDebounced: '' }))
    queueMicrotask(() => searchInputRef.current?.focus())
  }

  const [rawOrders, setRawOrders] = useState<OrderListEntry[]>([])
  const rawOrdersRef = useRef(rawOrders)
  useEffect(() => {
    rawOrdersRef.current = rawOrders
  }, [rawOrders])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedOnce = useRef(false)
  const loadRequestIdRef = useRef(0)
  const filterActive = isFilterActive(filter)
  const { fehler } = useToast()

  const loadOrders = useCallback(
    async (opts?: { isAlive?: () => boolean }) => {
      const requestId = ++loadRequestIdRef.current
      const isStale = () =>
        (opts?.isAlive !== undefined && !opts.isAlive()) ||
        requestId !== loadRequestIdRef.current

      if (hasLoadedOnce.current) setRefreshing(true)
      const trimmedSearch = searchDebounced.trim()
      let customerIds: string[] | null = null
      if (trimmedSearch) {
        try {
          customerIds = await customerService.searchCustomerIds(trimmedSearch)
        } catch {
          if (isStale()) return
          fehler('Orders could not be loaded')
          setRawOrders([])
          hasLoadedOnce.current = true
          setInitialLoading(false)
          setRefreshing(false)
          return
        }
        if (isStale()) return
        if (customerIds.length === 0) {
          if (isStale()) return
          setRawOrders([])
          hasLoadedOnce.current = true
          setInitialLoading(false)
          setRefreshing(false)
          return
        }
      }

      const selectedStatuses = statusTogglesToIn(statusToggles)
      if (!statusAll && selectedStatuses.length === 0) {
        if (isStale()) return
        setRawOrders([])
        hasLoadedOnce.current = true
        setInitialLoading(false)
        setRefreshing(false)
        return
      }

      if (isStale()) return

      let is_archived: boolean | undefined
      if (statusAll) {
        is_archived = false
      } else {
        const billedSelected = selectedStatuses.includes('INVOICED')
        const otherSelected = selectedStatuses.some(status => status !== 'INVOICED')
        if (billedSelected && otherSelected) {
          is_archived = undefined
        } else if (billedSelected) {
          is_archived = true
        } else {
          is_archived = false
        }
      }

      try {
        const data = await orderService.getOrdersForList({
          is_archived,
          customerIds: customerIds ?? undefined,
          statuses: !statusAll ? filterValidOrderStatuses(selectedStatuses) : undefined,
          deadlineFrom: deadlineFrom || undefined,
          deadlineTo: deadlineTo || undefined,
          intakeFrom: intakeFrom || undefined,
          intakeTo: intakeTo || undefined,
        })
        if (isStale()) return
        setRawOrders(data)
      } catch {
        if (isStale()) return
        fehler('Orders could not be loaded')
        setRawOrders([])
      }
      if (isStale()) return
      hasLoadedOnce.current = true
      setInitialLoading(false)
      setRefreshing(false)
    },
    [intakeTo, intakeFrom, fehler, searchDebounced, statusAll, statusToggles, deadlineTo, deadlineFrom]
  )

  useEffect(() => {
    let alive = true
    void loadOrders({ isAlive: () => alive })
    return () => {
      alive = false
    }
  }, [loadOrders])

  useEffect(() => {
    if (orderInPlace.tick === 0) return
    setRawOrders(previous =>
      previous.map(order => (order.id === orderInPlace.id ? { ...order, status: orderInPlace.status } : order))
    )
  }, [orderInPlace])

  useEffect(() => {
    return orderService.subscribeToCustomerChanges(customerId => {
      if (rawOrdersRef.current.some(order => order.customer_id === customerId)) {
        void loadOrders()
      }
    })
  }, [loadOrders])

  const orders = useMemo(() => {
    if (department === 'All') return rawOrders
    return rawOrders.filter(
      order => order.sub_orders?.some(subOrder => subOrder.department === department) ?? false,
    )
  }, [rawOrders, department])

  const resetFilter = () => {
    setFilter(defaultFilterState())
  }

  const isEmpty = !initialLoading && orders.length === 0

  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicateOrder, setDuplicateOrder] = useState<Auftrag | null>(null)
  const [duplicateSubOrders, setDuplicateSubOrders] = useState<SubOrderRow[]>([])

  const openDuplicateDialog = useCallback(
    async (auftragId: string) => {
      if (duplicateBusy) return
      setDuplicateBusy(true)
      setDuplicateError(null)
      try {
        const orderData = await orderService.getOrderById(auftragId)
        if (!orderData) throw new Error('Order not found')
        const subOrderData = await subOrderService.getSubOrdersByOrderId(auftragId)
        setDuplicateOrder(orderData as Auftrag)
        setDuplicateSubOrders(subOrderData)
        setDuplicateDialogOpen(true)
      } catch (e) {
        fehler('Orders could not be loaded')
        setDuplicateError(e instanceof Error ? e.message : String(e))
      } finally {
        setDuplicateBusy(false)
      }
    },
    [duplicateBusy, fehler]
  )

  return (
    <div className="ol-root">
      <div className="ol-head border-dashed">
        <div className="ol-head-row">
          <h1 className="ol-title">Order List</h1>
          <div className="ol-head-btns">
            <button
              type="button"
              className="ol-icon-btn"
              title="Search customer"
              aria-label="Search customer"
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen(o => !o)
                if (filterPopOpen) setFilterPopOpen(false)
              }}
            >
              🔍
            </button>
            <button
              type="button"
              className={`ol-icon-btn${filterActive ? ' ol-icon-btn--badge' : ''}`}
              title="Filter"
              aria-label="Filter"
              aria-pressed={filterPopOpen}
              onClick={() => {
                setFilterPopOpen(o => !o)
                if (searchOpen) setSearchOpen(false)
              }}
            >
              ⚙
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="ol-suche" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={searchInputRef}
              className="input-compact"
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search customer..."
              aria-label="Search customer"
              style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              className="ol-icon-btn"
              title="Clear search"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              ×
            </button>
          </div>
        )}

        {filterPopOpen && (
          <div className="ol-filter-pop">
            <div className="ol-filter-inhalt">
              <div className="ol-filter-row">
                <span className="ol-label">Status</span>
                <div className="ol-status-row">
                  <label className="ol-cb">
                    <input
                      type="checkbox"
                      checked={statusAll}
                      onChange={e => {
                        const checked = e.target.checked
                        setFilter(f => ({ ...f, statusAll: checked }))
                      }}
                    />
                    All
                  </label>
                  {!statusAll &&
                    STATUS_ORDER.map(status => (
                      <label key={status} className="ol-cb" title={status}>
                        <input
                          type="checkbox"
                          checked={statusToggles[status]}
                          onChange={e => {
                            const checked = e.target.checked
                            setFilter(f => ({
                              ...f,
                              statusAll: false,
                              statusToggles: { ...f.statusToggles, [status]: checked },
                            }))
                          }}
                        />
                        {STATUS_CHECKBOX_SHORT[status]}
                      </label>
                    ))}
                </div>
              </div>

              <div className="ol-filter-row">
                <label className="ol-label" htmlFor="ol-bereich">
                  Department
                </label>
                <select
                  id="ol-bereich"
                  className="input-compact"
                  value={department}
                  onChange={e =>
                    setFilter(f => ({ ...f, department: e.target.value as FilterState['department'] }))
                  }
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="All">All</option>
                  {SUB_ORDER_DEPARTMENTS.map(dep => (
                    <option key={dep} value={dep}>
                      {SUB_ORDER_DEPARTMENT_LABELS[dep]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ol-filter-row">
                <span className="ol-label">Deadline (from / to)</span>
                <div className="ol-filter-dates">
                  <DateInput
                    className="input-compact"
                    value={deadlineFrom}
                    onChange={e => setFilter(f => ({ ...f, deadlineFrom: e.target.value }))}
                  />
                  <DateInput
                    className="input-compact"
                    value={deadlineTo}
                    onChange={e => setFilter(f => ({ ...f, deadlineTo: e.target.value }))}
                  />
                </div>
              </div>

              <div className="ol-filter-row">
                <span className="ol-label">Intake (from / to)</span>
                <div className="ol-filter-dates">
                  <DateInput
                    className="input-compact"
                    value={intakeFrom}
                    onChange={e => setFilter(f => ({ ...f, intakeFrom: e.target.value }))}
                  />
                  <DateInput
                    className="input-compact"
                    value={intakeTo}
                    onChange={e => setFilter(f => ({ ...f, intakeTo: e.target.value }))}
                  />
                </div>
              </div>

              <button type="button" className="ol-filter-reset" onClick={resetFilter}>
                Reset filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ol-body" style={{ opacity: refreshing && !initialLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {initialLoading && <div className="ol-leer">Loading...</div>}
        {isEmpty && (
          <div className="ol-leer">
            <div style={{ marginBottom: 8 }}>No orders found</div>
            <button type="button" className="ol-filter-reset" onClick={resetFilter}>
              Reset filters
            </button>
          </div>
        )}
        {refreshing && !initialLoading && <div className="ol-aktual">Refreshing…</div>}
        {!initialLoading &&
          orders.map(order => {
            const isActive = order.id === activeOrderId
            const seenDepartments = new Set<string>()
            const uniqueDepartments: string[] = []
            for (const subOrder of order.sub_orders ?? []) {
              const dep = subOrder.department
              if (!dep || seenDepartments.has(dep)) continue
              seenDepartments.add(dep)
              uniqueDepartments.push(dep)
            }
            const maxTag = 4
            const tagLabels = uniqueDepartments.map(dep => departmentAbbreviation(dep))
            const visibleTags = tagLabels.slice(0, maxTag)
            const extraCount = tagLabels.length - maxTag
            return (
              <div
                key={order.id}
                className={isActive ? 'ol-eintrag ol-eintrag--aktiv' : 'ol-eintrag'}
                onClick={() => onSelectOrder(order.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectOrder(order.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="ol-eintrag-in">
                  <div className="ol-ze1">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        flex: 1,
                        gap: 4,
                      }}
                    >
                      <span className="ol-kunde">{customerName(order.customers)}</span>
                      {order.is_emergency && (
                        <span className="ol-alarm" title="Emergency" aria-label="Emergency">
                          !
                        </span>
                      )}
                      {order.priority === 'HIGH' && (
                        <span className="ol-prio" title="High priority" aria-label="High priority">
                          ↑
                        </span>
                      )}
                    </div>
                    <span className="ol-datum">{formatDateDe(order.created_at)}</span>
                  </div>
                  <div className="ol-ze2">
                    <span className={`badge ${statusBadgeClass(order.status)}`}>{statusLabel(order.status)}</span>
                    {visibleTags.map(tag => (
                      <span key={tag} className="ol-bereich-tag">
                        {tag}
                      </span>
                    ))}
                    {extraCount > 0 && <span className="ol-bereich-tag">+{extraCount}</span>}
                  </div>

                  {isActive && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="ol-icon-btn"
                        title="Duplicate order"
                        aria-label="Duplicate order"
                        disabled={duplicateBusy}
                        onClick={e => {
                          e.stopPropagation()
                          void openDuplicateDialog(order.id)
                        }}
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        className="ol-filter-reset"
                        disabled={duplicateBusy}
                        onClick={e => {
                          e.stopPropagation()
                          void openDuplicateDialog(order.id)
                        }}
                        style={{ padding: '6px 10px' }}
                      >
                        Duplicate order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <div className="ol-foot">
        <button type="button" className="ol-btn-neu" onClick={onNewOrder}>
          + New Order
        </button>
      </div>

      {duplicateError && <div className="ol-aktual">{duplicateError}</div>}

      {duplicateDialogOpen && duplicateOrder && (
        <DuplicateDialog
          auftrag={duplicateOrder}
          teilauftraege={duplicateSubOrders}
          onCancel={() => setDuplicateDialogOpen(false)}
          onSuccess={newOrder => {
            setDuplicateDialogOpen(false)
            void loadOrders().catch(() => fehler('Orders could not be refreshed'))
            onSelectOrder(newOrder.id)
          }}
        />
      )}
    </div>
  )
}
