import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { employeeService } from '../services/employeeService'
import { subOrderService } from '../services/subOrderService'
import { stampService } from '../services/stampService'
import { Login } from '../components/Login'
import { useToast } from '../components/Toast'
import { subOrderDetailToFieldMap } from '../lib/utils'
import type { Json } from '../types/supabase'

type StampType =
  | 'TRODAT_PRINTY'
  | 'HOLZSTEMPEL'
  | 'STATIVSTEMPEL'
  | 'DATUMSSTEMPEL'
  | 'STEMPELKISSEN_PRODUKT'
  | 'TRODAT_KISSEN'

const STAMP_TYPE_LABELS: Record<StampType, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  HOLZSTEMPEL: 'Holzstempel',
  STATIVSTEMPEL: 'Stativstempel',
  DATUMSSTEMPEL: 'Datumsstempel',
  STEMPELKISSEN_PRODUKT: 'Stempelkissen',
  TRODAT_KISSEN: 'Trodat Kissen',
}

function typeLabel(type: string): string {
  return (STAMP_TYPE_LABELS as Record<string, string>)[type] ?? type
}

const STAMP_TYPE_FILTER_OPTIONS: { value: StampType; label: string }[] = [
  { value: 'TRODAT_PRINTY', label: STAMP_TYPE_LABELS.TRODAT_PRINTY },
  { value: 'HOLZSTEMPEL', label: STAMP_TYPE_LABELS.HOLZSTEMPEL },
  { value: 'STATIVSTEMPEL', label: STAMP_TYPE_LABELS.STATIVSTEMPEL },
  { value: 'DATUMSSTEMPEL', label: STAMP_TYPE_LABELS.DATUMSSTEMPEL },
  { value: 'TRODAT_KISSEN', label: STAMP_TYPE_LABELS.TRODAT_KISSEN },
  { value: 'STEMPELKISSEN_PRODUKT', label: STAMP_TYPE_LABELS.STEMPELKISSEN_PRODUKT },
]

function formatNetRetailPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

type StampColorDb = 'SCHWARZ' | 'ROT' | 'BLAU' | 'GRUEN'

const STAMP_COLOR_LABELS: Record<StampColorDb, string> = {
  SCHWARZ: 'Schwarz',
  ROT: 'Rot',
  BLAU: 'Blau',
  GRUEN: 'Grün',
}

function colorLabel(colorCode: string | null | undefined): string {
  if (colorCode == null || colorCode === '') return '—'
  if ((Object.keys(STAMP_COLOR_LABELS) as StampColorDb[]).includes(colorCode as StampColorDb)) {
    return STAMP_COLOR_LABELS[colorCode as StampColorDb]
  }
  return colorCode
}

type StampModelRow = {
  id: string
  name: string
  type: StampType
  max_width_mm: number | null
  max_height_mm: number | null
  print_area: string | null
  article_number: string | null
  stock: number
  min_stock: number
  color: string | null
  net_price: number | null
  is_active: boolean
  note: string | null
  created_at: string
}

type MovementType = 'ZUGANG' | 'ABGANG' | 'AUTOABGANG'

type StockMovementRow = {
  id: string
  model_id: string
  quantity: number
  type: MovementType
  note: string | null
  user_id: string | null
  created_at: string
  stamp_models?: { name: string } | { name: string }[] | null
}

type Tab = 'OVERVIEW' | 'MOVEMENTS' | 'ORDER_LIST'

type StampModelOrderRow = {
  id: string
  name: string
  article_number: string | null
  type: StampType
  color: string | null
  stock: number
  min_stock: number
}

type OrderListRow = StampModelOrderRow & {
  offene_menge: number
  bestellmenge: number
}

function parseSubOrderQuantity(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const floored = Math.floor(raw)
    return floored >= 1 ? floored : 1
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 1) return parsed
  }
  return 1
}

/** Sichere Ganzzahl aus DB/JSON; verhindert [object Object] in Berechnungen. */
function toInteger(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function orderListNumber(value: unknown): number {
  const result = toInteger(value)
  return result < 0 ? 0 : result
}

function orderListCell(value: unknown, fallback: string = '—'): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value.trim() === '' ? fallback : value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'ja' : 'nein'
  if (typeof value === 'object') return fallback
  return String(value)
}

function errorToString(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const message = (e as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  try {
    return JSON.stringify(e)
  } catch {
    return 'Unbekannter Fehler'
  }
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function joinName(rawValue: unknown): string {
  if (!rawValue) return ''
  if (Array.isArray(rawValue)) {
    const first = rawValue[0]
    return typeof first === 'object' && first && 'name' in first
      ? String((first as Record<string, unknown>).name ?? '')
      : ''
  }
  return typeof rawValue === 'object' && rawValue && 'name' in rawValue ? String((rawValue as Record<string, unknown>).name ?? '') : ''
}

function statusInfo(model: StampModelRow): { cls: string; label: string; rank: number } {
  const stock = model.stock ?? 0
  const minimumStock = model.min_stock ?? 0
  if (stock <= 0) return { cls: 'badge-rot', label: 'Leer', rank: 0 }
  if (stock < minimumStock) return { cls: 'badge-rot', label: 'Nachbestellen', rank: 0 }
  if (stock === minimumStock) return { cls: 'badge-orange', label: 'Minimum', rank: 1 }
  return { cls: 'badge-gruen', label: 'OK', rank: 2 }
}

export function StampStockPage() {
  const { fehler: showError } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const session = await authService.getSession()
        if (!alive) return
        setSession(session)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const { subscription } = authService.onAuthStateChange((_event, newSession) => {
      if (!alive) return
      setSession(newSession)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const userEmail = session?.user?.email ?? session?.user?.id ?? ''

  const [tab, setTab] = useState<Tab>('OVERVIEW')

  // Shared: Mitarbeiter map
  const [staffEmailById, setStaffEmailById] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!session) return
    let alive = true
    employeeService.getEmployees().then(
      employees => {
        if (!alive) return
        const emailMap = new Map<string, string>()
        for (const row of employees) emailMap.set(row.id, row.email ?? '')
        setStaffEmailById(emailMap)
      },
      () => {
        if (alive) showError('Mitarbeiterdaten konnten nicht geladen werden')
      },
    )
    return () => {
      alive = false
    }
  }, [showError, session])

  // ------------------------------------------------------------
  // Tab 1: Übersicht
  // ------------------------------------------------------------
  const [models, setModels] = useState<StampModelRow[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const [filterReorderOnly, setFilterReorderOnly] = useState(false)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterColor, setFilterColor] = useState<string>('ALL')
  const [overviewSearch, setOverviewSearch] = useState('')

  type SortKey = 'name' | 'color' | 'print_area' | 'type' | 'stock' | 'min_stock' | 'status'
  const [sorting, setSorting] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)

  const toggleSort = (key: SortKey) => {
    setSorting(currentSorting => {
      if (!currentSorting || currentSorting.key !== key) return { key, dir: 'asc' }
      if (currentSorting.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const loadModels = async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const modelList = (await stampService.getStampModels() as unknown as StampModelRow[]).slice()
      // Standardsorting genau 1× beim ersten Laden anwenden (danach stabil).
      modelList.sort((a, b) => {
        const statusA = statusInfo(a)
        const statusB = statusInfo(b)
        if (statusA.rank !== statusB.rank) return statusA.rank - statusB.rank
        return a.name.localeCompare(b.name)
      })
      setModels(modelList)
    } catch (e) {
      showError('Daten konnten nicht geladen werden')
      setModels([])
      setModelsError(e instanceof Error ? e.message : String(e))
    } finally {
      setModelsLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'OVERVIEW') return
    void loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const filteredModels = useMemo(() => {
    let list = models.slice()
    if (filterType !== 'ALL') list = list.filter(model => model.type === filterType)
    if (
      filterColor !== 'ALL' &&
      (filterType === 'TRODAT_KISSEN' || filterType === 'STEMPELKISSEN_PRODUKT')
    ) {
      list = list.filter(model => model.color === filterColor)
    }
    if (filterReorderOnly) {
      list = list.filter(model => {
        const stock = model.stock ?? 0
        const minimumStock = model.min_stock ?? 0
        return stock <= minimumStock
      })
    }
    const searchQuery = overviewSearch.trim().toLowerCase()
    if (searchQuery) {
      list = list.filter(model => {
        const name = String(model.name ?? '').toLowerCase()
        const art = String(model.article_number ?? '').toLowerCase()
        return name.includes(searchQuery) || art.includes(searchQuery)
      })
    }
    if (sorting) {
      const dir = sorting.dir === 'asc' ? 1 : -1
      const key = sorting.key
      list = list.slice().sort((a, b) => {
        const aValue =
          key === 'name'
            ? a.name
            : key === 'color'
              ? (a.color ?? '')
              : key === 'print_area'
              ? (a.print_area ?? '')
              : key === 'type'
                ? a.type
                : key === 'stock'
                  ? a.stock ?? 0
                  : key === 'min_stock'
                    ? a.min_stock ?? 0
                    : statusInfo(a).rank
        const bValue =
          key === 'name'
            ? b.name
            : key === 'color'
              ? (b.color ?? '')
              : key === 'print_area'
              ? (b.print_area ?? '')
              : key === 'type'
                ? b.type
                : key === 'stock'
                  ? b.stock ?? 0
                  : key === 'min_stock'
                    ? b.min_stock ?? 0
                    : statusInfo(b).rank

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue !== bValue) return (aValue - bValue) * dir
        } else {
          const aStr = String(aValue)
          const bStr = String(bValue)
          const comparison = aStr.localeCompare(bStr)
          if (comparison !== 0) return comparison * dir
        }
        // stabiler Tie-Breaker
        return a.name.localeCompare(b.name)
      })
    }
    return list
  }, [filterColor, filterReorderOnly, filterType, models, sorting, overviewSearch])

  const [bookingQuantity, setBookingQuantity] = useState<Record<string, string>>({})
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [bookingErrors, setBookingErrors] = useState<Record<string, string | null>>({})

  const bookMovement = async (model: StampModelRow, movementType: 'ZUGANG' | 'ABGANG') => {
    if (!session?.user) return
    if (bookingBusyId) return
    const rawQuantity = (bookingQuantity[model.id] ?? '').trim()
    setBookingErrors(prev => ({ ...prev, [model.id]: null }))
    const quantity = parseInt(rawQuantity, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setBookingErrors(prev => ({ ...prev, [model.id]: 'Menge: ganze Zahl ≥ 1' }))
      return
    }
    const stockDelta = movementType === 'ZUGANG' ? quantity : -quantity
    const nextStock = (model.stock ?? 0) + stockDelta
    if (nextStock < 0) {
      setBookingErrors(prev => ({ ...prev, [model.id]: 'Menge überschreitet aktuellen Bestand' }))
      return
    }
    setBookingBusyId(model.id)
    try {
      await stampService.updateStampModelStock(model.id, nextStock)
      await stampService.createStockMovement({
        model_id: model.id,
        quantity,
        type: movementType,
        user_id: session.user.id,
      })

      setModels(list => list.map(stampModel => (stampModel.id === model.id ? { ...stampModel, stock: nextStock } : stampModel)))
      setBookingQuantity(prev => ({ ...prev, [model.id]: '' }))
    } catch (e) {
      showError('Buchung fehlgeschlagen')
      setBookingErrors(prev => ({ ...prev, [model.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBookingBusyId(null)
    }
  }

  const [minimumEdit, setMinimumEdit] = useState<Record<string, string>>({})
  const saveMinimumStock = async (model: StampModelRow) => {
    const rawValue = (minimumEdit[model.id] ?? String(model.min_stock ?? 0)).trim()
    const minimumValue = rawValue === '' ? 0 : parseInt(rawValue, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    if (minimumValue === (model.min_stock ?? 0)) return
    try {
      await stampService.updateStampModelMinimumStock(model.id, minimumValue)
    } catch {
      showError('Bestand konnte nicht aktualisiert werden')
      return
    }
    setModels(list => list.map(stampModel => (stampModel.id === model.id ? { ...stampModel, min_stock: minimumValue } : stampModel)))
  }

  // ------------------------------------------------------------
  // Tab 2: Bewegungen
  // ------------------------------------------------------------
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movementsError, setMovementsError] = useState<string | null>(null)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL')
  const [movementSearch, setMovementSearch] = useState('')

  const loadMovements = async () => {
    setMovementsLoading(true)
    setMovementsError(null)
    try {
      const data = await stampService.getStockMovements()
      setMovements(data as unknown as StockMovementRow[])
    } catch (e) {
      showError('Daten konnten nicht geladen werden')
      setMovements([])
      setMovementsError(e instanceof Error ? e.message : String(e))
    } finally {
      setMovementsLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'MOVEMENTS') return
    void loadMovements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const filteredMovements = useMemo(() => {
    const searchQuery = movementSearch.trim().toLowerCase()
    return movements.filter(movement => {
      if (movementTypeFilter !== 'ALL' && movement.type !== movementTypeFilter) return false
      if (!searchQuery) return true
      const name = joinName(movement.stamp_models).toLowerCase()
      const note = String(movement.note ?? '').toLowerCase()
      return name.includes(searchQuery) || note.includes(searchQuery)
    })
  }, [movements, movementSearch, movementTypeFilter])

  // ------------------------------------------------------------
  // Tab 3: Bestellliste
  // ------------------------------------------------------------
  const [orderListRows, setOrderListRows] = useState<OrderListRow[]>([])
  const [orderListLoading, setOrderListLoading] = useState(false)
  const [orderListError, setOrderListError] = useState<string | null>(null)
  const [orderListCopied, setOrderListCopied] = useState(false)

  const loadOrderList = async () => {
    setOrderListLoading(true)
    setOrderListError(null)
    try {
      const modelsData = await stampService.getStampModels()
      const allSubOrders = await subOrderService.getActiveSubOrdersByBereich('STAMP')
      const subOrderData = allSubOrders.filter(s => s.status !== 'DONE' && !s.is_cancelled)

      const activeModels = (modelsData as unknown as StampModelOrderRow[]).slice()
      const modelIdSet = new Set(activeModels.map(model => model.id))
      const demandByModelId = new Map<string, number>()

      for (const subOrderItem of (subOrderData ?? []) as { detail: Json }[]) {
        const fields = subOrderDetailToFieldMap(subOrderItem.detail)
        const quantity = parseSubOrderQuantity(fields.stueckzahl)
        const modelId = fields.modell_id != null && String(fields.modell_id).trim() !== '' ? String(fields.modell_id) : null
        const cushionModelId = fields.kissen_modell_id != null && String(fields.kissen_modell_id).trim() !== '' ? String(fields.kissen_modell_id) : null
        if (modelId && modelIdSet.has(modelId)) {
          demandByModelId.set(modelId, (demandByModelId.get(modelId) ?? 0) + quantity)
        }
        if (cushionModelId && modelIdSet.has(cushionModelId)) {
          demandByModelId.set(cushionModelId, (demandByModelId.get(cushionModelId) ?? 0) + quantity)
        }
      }

      const orderRows: OrderListRow[] = []
      for (const model of activeModels) {
        const offene_menge = toInteger(demandByModelId.get(model.id))
        const stockLevel = toInteger(model.stock)
        const minimumStock = toInteger(model.min_stock)
        const bestellmenge = Math.max(0, minimumStock + offene_menge - stockLevel)
        if (bestellmenge <= 0) continue
        orderRows.push({
          ...model,
          offene_menge,
          bestellmenge: toInteger(bestellmenge),
        })
      }
      orderRows.sort((a, b) => b.bestellmenge - a.bestellmenge)
      setOrderListRows(orderRows)
    } catch (e) {
      showError('Daten konnten nicht geladen werden')
      setOrderListRows([])
      setOrderListError(errorToString(e))
    } finally {
      setOrderListLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    if (tab !== 'ORDER_LIST') return
    void loadOrderList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab])

  const orderListClipboardText = useMemo(() => {
    const header = 'Artikelnummer | Name | Farbe | Menge'
    const body = orderListRows
      .map(orderRow => {
        const art = orderListCell(orderRow.article_number, '—')
        const name = orderListCell(orderRow.name, '—')
        const colorValue = typeof orderRow.color === 'string' ? orderRow.color : null
        return `${art} | ${name} | ${colorLabel(colorValue)} | ${orderListNumber(orderRow.bestellmenge)}`
      })
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [orderListRows])

  const copyOrderList = async () => {
    try {
      await navigator.clipboard.writeText(orderListClipboardText)
      setOrderListCopied(true)
      window.setTimeout(() => setOrderListCopied(false), 2000)
    } catch {
      showError('Kopieren fehlgeschlagen')
    }
  }

  const logout = async () => {
    await authService.signOut()
  }

  if (loading) return null
  if (!session) return <Login />

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Stempel — Bestandspflege</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
        <button
          type="button"
          className={tab === 'OVERVIEW' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('OVERVIEW')}
        >
          Übersicht
        </button>
        <button
          type="button"
          className={tab === 'MOVEMENTS' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('MOVEMENTS')}
        >
          Bewegungen
        </button>
        <button
          type="button"
          className={tab === 'ORDER_LIST' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('ORDER_LIST')}
        >
          Bestellliste
        </button>
      </div>

      {tab === 'OVERVIEW' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              type="search"
              className="cp-select"
              placeholder="Name oder Artikelnummer…"
              value={overviewSearch}
              onChange={e => setOverviewSearch(e.target.value)}
              aria-label="Suche Name oder Artikelnummer"
              style={{ minWidth: 220, maxWidth: 320 }}
            />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={filterReorderOnly}
                onChange={e => setFilterReorderOnly(e.target.checked)}
              />
              Nur Nachbestellen
            </label>
            <select
              className="cp-select"
              value={filterType}
              onChange={e => {
                const selectedValue = e.target.value
                setFilterType(selectedValue)
                if (selectedValue !== 'TRODAT_KISSEN' && selectedValue !== 'STEMPELKISSEN_PRODUKT') setFilterColor('ALL')
              }}
              style={{ maxWidth: 260 }}
            >
              <option value="ALL">Alle Typen</option>
              {STAMP_TYPE_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {(filterType === 'TRODAT_KISSEN' || filterType === 'STEMPELKISSEN_PRODUKT') && (
              <select
                className="cp-select"
                value={filterColor}
                onChange={e => setFilterColor(e.target.value)}
                style={{ maxWidth: 200 }}
                aria-label="Filter Farbe"
              >
                <option value="ALL">Alle Farben</option>
                {(Object.keys(STAMP_COLOR_LABELS) as StampColorDb[]).map(colorKey => (
                  <option key={colorKey} value={colorKey}>
                    {STAMP_COLOR_LABELS[colorKey]}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="cp-btn cp-btn-grau" onClick={() => void loadModels()} disabled={modelsLoading}>
              Neu laden
            </button>
          </div>

          {modelsError && <p style={{ color: '#b91c1c' }}>{modelsError}</p>}
          {modelsLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('name')}
                    title="Sortieren"
                  >
                    Name{sorting?.key === 'name' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('color')}
                    title="Sortieren"
                  >
                    Farbe{sorting?.key === 'color' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('print_area')}
                    title="Sortieren"
                  >
                    Druckfläche{sorting?.key === 'print_area' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('type')}
                    title="Sortieren"
                  >
                    Typ{sorting?.key === 'type' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('stock')}
                    title="Sortieren"
                  >
                    Bestand{sorting?.key === 'stock' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('min_stock')}
                    title="Sortieren"
                  >
                    Mindestbestand
                    {sorting?.key === 'min_stock' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                  <th style={{ padding: '8px 6px' }}>VK-Preis</th>
                  <th
                    style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort('status')}
                    title="Sortieren"
                  >
                    Status{sorting?.key === 'status' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map(model => {
                  const status = statusInfo(model)
                  const minEditValue = minimumEdit[model.id]
                  const minimumDisplay = minEditValue != null ? minEditValue : String(model.min_stock ?? 0)
                  const quantityStr = (bookingQuantity[model.id] ?? '').slice(0, 3)
                  const quantity = quantityStr.trim() === '' ? null : parseInt(quantityStr, 10)
                  const quantityValid = quantity != null && Number.isInteger(quantity) && quantity >= 1
                  const inboundDisabled = !quantityValid || bookingBusyId != null
                  const outboundDisabled = !quantityValid || bookingBusyId != null || (quantityValid && (quantity as number) > (model.stock ?? 0))
                  return (
                    <tr key={model.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{model.name}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{colorLabel(model.color)}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.85 }}>{model.print_area ?? ''}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typeLabel(model.type)}</td>
                      <td style={{ padding: '8px 6px' }}>{model.stock ?? 0}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          className="cp-select"
                          value={minimumDisplay}
                          min={0}
                          step={1}
                          onChange={e => setMinimumEdit(prev => ({ ...prev, [model.id]: e.target.value }))}
                          onBlur={() => void saveMinimumStock(model)}
                          style={{ maxWidth: 110 }}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>{formatNetRetailPrice(model.net_price)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className={`badge ${status.cls}`}>{status.label}</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={1}
                              max={999}
                              step={1}
                              value={quantityStr}
                              onChange={e => {
                                const inputValue = e.target.value
                                const cleaned = inputValue.replace(/[^\d]/g, '').slice(0, 3)
                                setBookingQuantity(prev => ({ ...prev, [model.id]: cleaned }))
                              }}
                              style={{
                                width: 52,
                                padding: '6px 8px',
                                border: '1px solid #d4d4d4',
                                borderRadius: 6,
                                fontSize: 13,
                                appearance: 'textfield',
                              }}
                            />
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              style={{ width: 34, padding: '6px 0', textAlign: 'center' }}
                              disabled={inboundDisabled}
                              onClick={() => void bookMovement(model, 'ZUGANG')}
                              title="Zugang buchen"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              style={{ width: 34, padding: '6px 0', textAlign: 'center' }}
                              disabled={outboundDisabled}
                              onClick={() => void bookMovement(model, 'ABGANG')}
                              title="Abgang buchen"
                            >
                              -
                            </button>
                          </div>
                        </div>
                        {bookingErrors[model.id] && <div style={{ marginTop: 6, color: '#b91c1c' }}>{bookingErrors[model.id]}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'MOVEMENTS' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select
              className="cp-select"
              value={movementTypeFilter}
              onChange={e => {
                const selectedValue = (e.target as HTMLSelectElement).value
                if (selectedValue === 'ALL') setMovementTypeFilter('ALL')
                else if (selectedValue === 'ZUGANG' || selectedValue === 'ABGANG' || selectedValue === 'AUTOABGANG') setMovementTypeFilter(selectedValue)
              }}
              style={{ maxWidth: 220 }}
            >
              <option value="ALL">Alle</option>
              <option value="ZUGANG">Zugang</option>
              <option value="ABGANG">Abgang</option>
              <option value="AUTOABGANG">Auto-Abgang</option>
            </select>
            <input
              type="text"
              className="cp-select"
              placeholder="Modell suchen…"
              value={movementSearch}
              onChange={e => setMovementSearch(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <button type="button" className="cp-btn cp-btn-grau" onClick={() => void loadMovements()} disabled={movementsLoading}>
              Neu laden
            </button>
          </div>

          {movementsError && <p style={{ color: '#b91c1c' }}>{movementsError}</p>}
          {movementsLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px' }}>Datum</th>
                  <th style={{ padding: '8px 6px' }}>Modell</th>
                  <th style={{ padding: '8px 6px' }}>Typ</th>
                  <th style={{ padding: '8px 6px' }}>Menge</th>
                  <th style={{ padding: '8px 6px' }}>Notiz</th>
                  <th style={{ padding: '8px 6px' }}>Person</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(movement => {
                  const movementBadge =
                    movement.type === 'ZUGANG'
                      ? { cls: 'badge-gruen', label: 'Zugang' }
                      : movement.type === 'ABGANG'
                      ? { cls: 'badge-grau', label: 'Abgang' }
                      : { cls: 'badge-blau', label: 'Auto-Abgang' }
                  const personEmail = movement.user_id ? staffEmailById.get(movement.user_id) ?? movement.user_id : ''
                  return (
                    <tr key={movement.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px' }}>{formatDateTime(movement.created_at)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{joinName(movement.stamp_models)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span className={`badge ${movementBadge.cls}`}>{movementBadge.label}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>{movement.quantity}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{movement.note ?? ''}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.85 }}>{personEmail}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ORDER_LIST' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button
              type="button"
              className="cp-btn cp-btn-grau"
              onClick={() => void loadOrderList()}
              disabled={orderListLoading}
            >
              Aktualisieren
            </button>
            <button
              type="button"
              className="cp-btn"
              onClick={() => void copyOrderList()}
              disabled={orderListLoading || orderListRows.length === 0}
            >
              Kopieren
            </button>
            {orderListCopied && (
              <span style={{ fontSize: 13, color: '#15803d' }}>In Zwischenablage kopiert</span>
            )}
          </div>

          {orderListError && <p style={{ color: '#b91c1c' }}>{orderListError}</p>}
          {orderListLoading && <p style={{ opacity: 0.8 }}>Lädt…</p>}

          {!orderListLoading && !orderListError && orderListRows.length === 0 && (
            <p style={{ margin: '12px 0', color: '#15803d', fontWeight: 600 }}>
              Alles auf Lager — keine Bestellung nötig
            </p>
          )}

          {orderListRows.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 6px' }}>Name</th>
                    <th style={{ padding: '8px 6px' }}>Artikelnummer</th>
                    <th style={{ padding: '8px 6px' }}>Typ</th>
                    <th style={{ padding: '8px 6px' }}>Farbe</th>
                    <th style={{ padding: '8px 6px' }}>Bestand</th>
                    <th style={{ padding: '8px 6px' }}>Offene Aufträge</th>
                    <th style={{ padding: '8px 6px' }}>Mindestbestand</th>
                    <th style={{ padding: '8px 6px' }}>Bestellen</th>
                  </tr>
                </thead>
                <tbody>
                  {orderListRows.map(orderRow => {
                    const typeStr = typeof orderRow.type === 'string' ? orderRow.type : orderListCell(orderRow.type, '')
                    const colorValue = typeof orderRow.color === 'string' ? orderRow.color : null
                    return (
                    <tr key={String(orderRow.id)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{orderListCell(orderRow.name, '—')}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListCell(orderRow.article_number, '—')}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{typeLabel(typeStr)}</td>
                      <td style={{ padding: '8px 6px', opacity: 0.9 }}>{colorLabel(colorValue)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.stock)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.offene_menge)}</td>
                      <td style={{ padding: '8px 6px' }}>{orderListNumber(orderRow.min_stock)}</td>
                      <td
                        style={{
                          padding: '8px 6px',
                          fontWeight: 700,
                          color: '#b91c1c',
                        }}
                      >
                        {orderListNumber(orderRow.bestellmenge)}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

