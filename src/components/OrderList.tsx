import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { customerService } from '../services/customerService'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { SUB_ORDER_COLUMNS } from '../const/subOrderSelect'
import { formatDateDe } from '../lib/formatDate'
import { customerName } from '../lib/customer'
import {
  SUB_ORDER_DEPARTMENTS,
  SUB_ORDER_DEPARTMENT_LABELS,
  type Auftrag,
  type OrderStatus,
  type SubOrderRow,
} from '../types/database'
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
  'ANGEBOT',
  'UNVOLLSTAENDIG',
  'PREPRESS_BEREIT',
  'PRODUKTION_BEREIT',
  'FERTIG',
  'ABGERECHNET',
]

const DEFAULT_STATUS_TOGGLES: Record<OrderStatus, boolean> = {
  ANGEBOT: true,
  UNVOLLSTAENDIG: true,
  PREPRESS_BEREIT: true,
  PRODUKTION_BEREIT: true,
  FERTIG: false,
  ABGERECHNET: false,
}

/** Short label for the status filter checkboxes. */
const STATUS_CHECKBOX_SHORT: Record<OrderStatus, string> = {
  ANGEBOT: 'Angebot',
  UNVOLLSTAENDIG: 'Unvollst.',
  PREPRESS_BEREIT: 'PrePress',
  PRODUKTION_BEREIT: 'Produkt.',
  FERTIG: 'Fertig',
  ABGERECHNET: 'Abgerech.',
}

type SubOrderDepartmentRow = { bereich: string; status: string }
type OrderListEntry = {
  id: string
  auftragsnummer: string
  status: OrderStatus
  erstellt_am: string
  termin: string | null
  prioritaet: 'NORMAL' | 'HOCH'
  notfall_aktiv: boolean
  kunde_id: string
  kunden: { name: string } | { name: string }[] | null
  teilauftraege: SubOrderDepartmentRow[] | null
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
    department: 'Alle' as 'Alle' | (typeof SUB_ORDER_DEPARTMENTS)[number],
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
  if (filterState.department !== 'Alle') return true
  if (filterState.statusAll !== defaultState.statusAll) return true
  for (const status of STATUS_ORDER) {
    if (filterState.statusToggles[status] !== defaultState.statusToggles[status]) return true
  }
  return false
}

function statusBadgeClass(s: OrderStatus): string {
  switch (s) {
    case 'ANGEBOT':
      return 'badge-grau'
    case 'UNVOLLSTAENDIG':
      return 'badge-orange'
    case 'PREPRESS_BEREIT':
      return 'badge-blau'
    case 'PRODUKTION_BEREIT':
      return 'badge-lila'
    case 'FERTIG':
      return 'badge-gruen'
    default:
      return 'badge-grau'
  }
}

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    ANGEBOT: 'Angebot',
    UNVOLLSTAENDIG: 'Unvollständig',
    PREPRESS_BEREIT: 'PrePress',
    PRODUKTION_BEREIT: 'Produktion',
    FERTIG: 'Fertig',
    ABGERECHNET: 'Abgerechnet',
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
          fehler('Aufträge konnten nicht geladen werden')
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

      let query = supabase
        .from('auftraege')
        .select(
          'id, auftragsnummer, status, erstellt_am, termin, prioritaet, notfall_aktiv, kunde_id, kunden(name), teilauftraege(bereich, status)',
        )
        .order('erstellt_am', { ascending: false })

      if (statusAll) {
        query = query.eq('archiviert', false)
      } else {
        const billedSelected = selectedStatuses.includes('ABGERECHNET')
        const otherSelected = selectedStatuses.some(status => status !== 'ABGERECHNET')
        if (billedSelected && otherSelected) {
          // no archiviert filter — shows both archived and non-archived
        } else if (billedSelected) {
          query = query.eq('archiviert', true)
        } else {
          query = query.eq('archiviert', false)
        }
      }

      if (customerIds) query = query.in('kunde_id', customerIds)
      if (!statusAll) {
        const validStatuses = filterValidOrderStatuses(selectedStatuses)
        query = query.in('status', validStatuses)
      }
      if (deadlineFrom) query = query.gte('termin', deadlineFrom)
      if (deadlineTo) query = query.lte('termin', deadlineTo)
      if (intakeFrom) query = query.gte('erstellt_am', `${intakeFrom}T00:00:00`)
      if (intakeTo) query = query.lte('erstellt_am', `${intakeTo}T23:59:59.999`)

      const { data, error } = await query
      if (isStale()) return
      if (error) {
        fehler('Aufträge konnten nicht geladen werden')
        setRawOrders([])
      } else {
        setRawOrders((data as OrderListEntry[]) ?? [])
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
    const channel = supabase
      .channel('orderlist-kunden-refresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kunden' },
        payload => {
          const customerId = (payload.new as { id?: string } | null)?.id
          if (!customerId) return
          const affected = rawOrdersRef.current.some(order => order.kunde_id === customerId)
          if (!affected) return
          void loadOrders()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kunden' },
        payload => {
          const customerId = (payload.new as { id?: string } | null)?.id
          if (!customerId) return
          const affected = rawOrdersRef.current.some(order => order.kunde_id === customerId)
          if (!affected) return
          void loadOrders()
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'kunden' },
        payload => {
          const customerId = (payload.old as { id?: string } | null)?.id
          if (!customerId) return
          const affected = rawOrdersRef.current.some(order => order.kunde_id === customerId)
          if (!affected) return
          void loadOrders()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadOrders])

  const orders = useMemo(() => {
    if (department === 'Alle') return rawOrders
    return rawOrders.filter(
      order => order.teilauftraege?.some(subOrder => subOrder.bereich === department) ?? false,
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
        const { data: orderData, error: orderError } = await supabase
          .from('auftraege')
          .select(ORDER_COLUMNS)
          .eq('id', auftragId)
          .single()
        if (orderError) throw orderError
        const { data: subOrderData, error: subOrderError } = await supabase
          .from('teilauftraege')
          .select(SUB_ORDER_COLUMNS)
          .eq('auftrag_id', auftragId)
        if (subOrderError) throw subOrderError
        setDuplicateOrder(orderData as Auftrag)
        setDuplicateSubOrders((subOrderData ?? []) as SubOrderRow[])
        setDuplicateDialogOpen(true)
      } catch (e) {
        fehler('Aufträge konnten nicht geladen werden')
        setDuplicateError(e instanceof Error ? e.message : String(e))
      } finally {
        setDuplicateBusy(false)
      }
    },
    [duplicateBusy, fehler]
  )

  return (
    <div className="ol-root">
      <div className="ol-head">
        <div className="ol-head-row">
          <h1 className="ol-title">Auftragsliste</h1>
          <div className="ol-head-btns">
            <button
              type="button"
              className="ol-icon-btn"
              title="Kunde suchen"
              aria-label="Kunde suchen"
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
              placeholder="Kunde suchen..."
              aria-label="Kunde suchen"
              style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              className="ol-icon-btn"
              title="Suche löschen"
              aria-label="Suche löschen"
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
                    Alle
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
                  Bereich
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
                  <option value="Alle">Alle</option>
                  {SUB_ORDER_DEPARTMENTS.map(dep => (
                    <option key={dep} value={dep}>
                      {SUB_ORDER_DEPARTMENT_LABELS[dep]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ol-filter-row">
                <span className="ol-label">Termin (von / bis)</span>
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
                <span className="ol-label">Annahme (von / bis)</span>
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
                Filter zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ol-body" style={{ opacity: refreshing && !initialLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {initialLoading && <div className="ol-leer">Lädt...</div>}
        {isEmpty && (
          <div className="ol-leer">
            <div style={{ marginBottom: 8 }}>Keine Aufträge gefunden</div>
            <button type="button" className="ol-filter-reset" onClick={resetFilter}>
              Filter zurücksetzen
            </button>
          </div>
        )}
        {refreshing && !initialLoading && <div className="ol-aktual">Aktualisiere…</div>}
        {!initialLoading &&
          orders.map(order => {
            const isActive = order.id === activeOrderId
            const seenDepartments = new Set<string>()
            const uniqueDepartments: string[] = []
            for (const subOrder of order.teilauftraege ?? []) {
              const dep = subOrder.bereich
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
                      <span className="ol-kunde">{customerName(order.kunden)}</span>
                      {order.notfall_aktiv && (
                        <span className="ol-alarm" title="Notfall" aria-label="Notfall">
                          !
                        </span>
                      )}
                      {order.prioritaet === 'HOCH' && (
                        <span className="ol-prio" title="Priorität hoch" aria-label="Priorität hoch">
                          ↑
                        </span>
                      )}
                    </div>
                    <span className="ol-datum">{formatDateDe(order.erstellt_am)}</span>
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
                        title="Auftrag duplizieren"
                        aria-label="Auftrag duplizieren"
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
                        Auftrag duplizieren
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
          + Neuer Auftrag
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
            void loadOrders().catch(() => fehler('Aufträge konnten nicht aktualisiert werden'))
            onSelectOrder(newOrder.id)
          }}
        />
      )}
    </div>
  )
}
