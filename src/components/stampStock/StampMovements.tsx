import { useCallback, useEffect, useMemo, useState } from 'react'
import { stampService, type StockMovementRow } from '../../services/stampService'
import { userService } from '../../services/userService'
import { formatDateTimeDe } from '../../lib/formatDate'
import { useToast } from '../Toast'
import { useStampStockUi } from './useStampStockUi'

export function StampMovements() {
  const { showError } = useToast()
  const {
    movementTypeFilter,
    setMovementTypeFilter,
    movementSearch,
    setMovementSearch,
  } = useStampStockUi()

  const [staffEmailById, setStaffEmailById] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let alive = true
    userService.getUsers().then(
      users => {
        if (!alive) return
        const emailMap = new Map<string, string>()
        for (const row of users) emailMap.set(row.id, row.email ?? '')
        setStaffEmailById(emailMap)
      },
      () => {
        if (alive) showError('Staff data could not be loaded')
      },
    )
    return () => {
      alive = false
    }
  }, [showError])

  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [movementsLoading, setMovementsLoading] = useState(true)
  const [movementsError, setMovementsError] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    try {
      const data = await stampService.getStockMovements()
      setMovements(data)
      setMovementsError(null)
    } catch (e) {
      showError('Data could not be loaded')
      setMovements([])
      setMovementsError(e instanceof Error ? e.message : String(e))
    } finally {
      setMovementsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative fetch-on-mount, kept from the pre-split page; react-query migration is a follow-up
    void fetchMovements()
  }, [fetchMovements])

  const refreshMovements = () => {
    setMovementsLoading(true)
    setMovementsError(null)
    void fetchMovements()
  }

  const filteredMovements = useMemo(() => {
    const searchQuery = movementSearch.trim().toLowerCase()
    return movements.filter(movement => {
      if (movementTypeFilter !== 'ALL' && movement.type !== movementTypeFilter) return false
      if (!searchQuery) return true
      const name = (movement.stamp_models?.name ?? '').toLowerCase()
      const note = String(movement.note ?? '').toLowerCase()
      return name.includes(searchQuery) || note.includes(searchQuery)
    })
  }, [movements, movementSearch, movementTypeFilter])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          className="cp-select"
          value={movementTypeFilter}
          onChange={e => {
            const selectedValue = (e.target as HTMLSelectElement).value
            if (selectedValue === 'ALL') setMovementTypeFilter('ALL')
            else if (selectedValue === 'INBOUND' || selectedValue === 'OUTBOUND' || selectedValue === 'AUTO_DEDUCTION') setMovementTypeFilter(selectedValue)
          }}
          style={{ maxWidth: 220 }}
        >
          <option value="ALL">All</option>
          <option value="INBOUND">Stock in</option>
          <option value="OUTBOUND">Stock out</option>
          <option value="AUTO_DEDUCTION">Auto stock-out</option>
        </select>
        <input
          type="text"
          className="cp-select"
          placeholder="Search model…"
          value={movementSearch}
          onChange={e => setMovementSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <button type="button" className="cp-btn cp-btn-grau" onClick={refreshMovements} disabled={movementsLoading}>
          Refresh
        </button>
      </div>

      {movementsError && <p style={{ color: '#b91c1c' }}>{movementsError}</p>}
      {movementsLoading && <p style={{ opacity: 0.8 }}>Loading…</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '8px 6px' }}>Date</th>
              <th style={{ padding: '8px 6px' }}>Model</th>
              <th style={{ padding: '8px 6px' }}>Type</th>
              <th style={{ padding: '8px 6px' }}>Quantity</th>
              <th style={{ padding: '8px 6px' }}>Note</th>
              <th style={{ padding: '8px 6px' }}>Person</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.map(movement => {
              const movementBadge =
                movement.type === 'INBOUND'
                  ? { cls: 'badge-gruen', label: 'Stock in' }
                  : movement.type === 'OUTBOUND'
                  ? { cls: 'badge-grau', label: 'Stock out' }
                  : { cls: 'badge-blau', label: 'Auto stock-out' }
              const personEmail = movement.user_id ? staffEmailById.get(movement.user_id) ?? movement.user_id : ''
              return (
                <tr key={movement.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 6px' }}>{formatDateTimeDe(movement.created_at)}</td>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{movement.stamp_models?.name ?? ''}</td>
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
  )
}
