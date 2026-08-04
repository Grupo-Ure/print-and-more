import { useCallback, useEffect, useMemo, useState } from 'react'
import { stampService } from '../../services/stampService'
import { useToast } from '../Toast'
import { useStampStockUi } from './useStampStockUi'
import {
  STAMP_COLOR_LABELS,
  STAMP_TYPE_FILTER_OPTIONS,
  colorLabel,
  formatNetRetailPrice,
  statusInfo,
  typeLabel,
  type StampColorDb,
  type StampModelRow,
} from './stampStockShared'

type StampOverviewProps = {
  /** Booked movements are attributed to this user. */
  userId: string
}

export function StampOverview({ userId }: StampOverviewProps) {
  const { showError } = useToast()
  const {
    overviewSearch,
    setOverviewSearch,
    filterType,
    setFilterType,
    filterColor,
    setFilterColor,
    filterReorderOnly,
    setFilterReorderOnly,
    overviewSorting: sorting,
    toggleOverviewSort: toggleSort,
  } = useStampStockUi()

  const [models, setModels] = useState<StampModelRow[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    try {
      const modelList = (await stampService.getStampModels()).slice()
      // Default sort applied exactly once on load (stable afterwards).
      modelList.sort((a, b) => {
        const statusA = statusInfo(a)
        const statusB = statusInfo(b)
        if (statusA.rank !== statusB.rank) return statusA.rank - statusB.rank
        return a.name.localeCompare(b.name)
      })
      setModels(modelList)
      setModelsError(null)
    } catch (e) {
      showError('Data could not be loaded')
      setModels([])
      setModelsError(e instanceof Error ? e.message : String(e))
    } finally {
      setModelsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void fetchModels()
  }, [fetchModels])

  const refreshModels = () => {
    setModelsLoading(true)
    setModelsError(null)
    void fetchModels()
  }

  const filteredModels = useMemo(() => {
    let list = models.slice()
    if (filterType !== 'ALL') list = list.filter(model => model.type === filterType)
    if (
      filterColor !== 'ALL' &&
      (filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT')
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
        // stable tie-breaker
        return a.name.localeCompare(b.name)
      })
    }
    return list
  }, [filterColor, filterReorderOnly, filterType, models, sorting, overviewSearch])

  const [bookingQuantity, setBookingQuantity] = useState<Record<string, string>>({})
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [bookingErrors, setBookingErrors] = useState<Record<string, string | null>>({})

  const bookMovement = async (model: StampModelRow, movementType: 'INBOUND' | 'OUTBOUND') => {
    if (bookingBusyId) return
    const rawQuantity = (bookingQuantity[model.id] ?? '').trim()
    setBookingErrors(prev => ({ ...prev, [model.id]: null }))
    const quantity = parseInt(rawQuantity, 10)
    if (!Number.isInteger(quantity) || quantity < 1) {
      setBookingErrors(prev => ({ ...prev, [model.id]: 'Quantity: integer ≥ 1' }))
      return
    }
    const stockDelta = movementType === 'INBOUND' ? quantity : -quantity
    const nextStock = (model.stock ?? 0) + stockDelta
    if (nextStock < 0) {
      setBookingErrors(prev => ({ ...prev, [model.id]: 'Quantity exceeds current stock' }))
      return
    }
    setBookingBusyId(model.id)
    try {
      await stampService.updateStampModelStock(model.id, nextStock)
      await stampService.createStockMovement({
        model_id: model.id,
        quantity,
        type: movementType,
        user_id: userId,
      })

      setModels(list => list.map(stampModel => (stampModel.id === model.id ? { ...stampModel, stock: nextStock } : stampModel)))
      setBookingQuantity(prev => ({ ...prev, [model.id]: '' }))
    } catch (e) {
      showError('Booking failed')
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
      showError('Stock could not be updated')
      return
    }
    setModels(list => list.map(stampModel => (stampModel.id === model.id ? { ...stampModel, min_stock: minimumValue } : stampModel)))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="search"
          className="cp-select"
          placeholder="Name or article number…"
          value={overviewSearch}
          onChange={e => setOverviewSearch(e.target.value)}
          aria-label="Search name or article number"
          style={{ minWidth: 220, maxWidth: 320 }}
        />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={filterReorderOnly}
            onChange={e => setFilterReorderOnly(e.target.checked)}
          />
          Only reorder
        </label>
        <select
          className="cp-select"
          value={filterType}
          onChange={e => {
            const selectedValue = e.target.value
            setFilterType(selectedValue)
            if (selectedValue !== 'TRODAT_PAD' && selectedValue !== 'INK_PAD_PRODUCT') setFilterColor('ALL')
          }}
          style={{ maxWidth: 260 }}
        >
          <option value="ALL">All types</option>
          {STAMP_TYPE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {(filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT') && (
          <select
            className="cp-select"
            value={filterColor}
            onChange={e => setFilterColor(e.target.value)}
            style={{ maxWidth: 200 }}
            aria-label="Filter colour"
          >
            <option value="ALL">All colours</option>
            {(Object.keys(STAMP_COLOR_LABELS) as StampColorDb[]).map(colorKey => (
              <option key={colorKey} value={colorKey}>
                {STAMP_COLOR_LABELS[colorKey]}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="cp-btn cp-btn-grau" onClick={refreshModels} disabled={modelsLoading}>
          Refresh
        </button>
      </div>

      {modelsError && <p style={{ color: '#b91c1c' }}>{modelsError}</p>}
      {modelsLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('name')}
                title="Sort"
              >
                Name{sorting?.key === 'name' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('color')}
                title="Sort"
              >
                Colour{sorting?.key === 'color' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('print_area')}
                title="Sort"
              >
                Print area{sorting?.key === 'print_area' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('type')}
                title="Sort"
              >
                Type{sorting?.key === 'type' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('stock')}
                title="Sort"
              >
                Stock{sorting?.key === 'stock' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('min_stock')}
                title="Sort"
              >
                Min. stock
                {sorting?.key === 'min_stock' ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th style={{ padding: '8px 6px' }}>Net price</th>
              <th
                style={{ padding: '8px 6px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('status')}
                title="Sort"
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
                          onClick={() => void bookMovement(model, 'INBOUND')}
                          title="Book stock in"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn-grau"
                          style={{ width: 34, padding: '6px 0', textAlign: 'center' }}
                          disabled={outboundDisabled}
                          onClick={() => void bookMovement(model, 'OUTBOUND')}
                          title="Book stock out"
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
  )
}
