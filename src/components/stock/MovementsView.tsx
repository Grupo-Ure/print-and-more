import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTimeDe } from '../../lib/formatDate'
import { useUsers } from '../../queries/userQueries'
import { MOVEMENT_TYPE_BADGES, type MovementType } from './stockShared'

export type StockMovementEntry = {
  id: string
  created_at: string
  /** What was moved — e.g. the stamp model name or "Brand Product · Colour · Size". */
  itemLabel: string
  type: string
  quantity: number
  note: string | null
  user_id: string | null
}

type MovementsViewProps = {
  movements: StockMovementEntry[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  itemColumnHeader: string
  searchPlaceholder: string
  typeFilter: 'ALL' | MovementType
  onTypeFilterChange: (value: 'ALL' | MovementType) => void
  search: string
  onSearchChange: (value: string) => void
}

/** Movement history list shared by the stamp and textile stock pages. */
export function MovementsView({
  movements,
  isLoading,
  error,
  onRefresh,
  itemColumnHeader,
  searchPlaceholder,
  typeFilter,
  onTypeFilterChange,
  search,
  onSearchChange,
}: MovementsViewProps) {
  const { data: users } = useUsers()
  const emailById = useMemo(() => {
    const map = new Map<string, string>()
    for (const user of users ?? []) map.set(user.id, user.email ?? '')
    return map
  }, [users])

  const filteredMovements = useMemo(() => {
    const searchQuery = search.trim().toLowerCase()
    return movements.filter(movement => {
      if (typeFilter !== 'ALL' && movement.type !== typeFilter) return false
      if (!searchQuery) return true
      const label = movement.itemLabel.toLowerCase()
      const note = (movement.note ?? '').toLowerCase()
      return label.includes(searchQuery) || note.includes(searchQuery)
    })
  }, [movements, search, typeFilter])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={event => {
            const selectedValue = event.target.value
            if (
              selectedValue === 'ALL' ||
              selectedValue === 'INBOUND' ||
              selectedValue === 'OUTBOUND' ||
              selectedValue === 'AUTO_DEDUCTION'
            ) {
              onTypeFilterChange(selectedValue)
            }
          }}
          className="h-8 max-w-55 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Filter movement type"
        >
          <option value="ALL">All</option>
          <option value="INBOUND">{MOVEMENT_TYPE_BADGES.INBOUND.label}</option>
          <option value="OUTBOUND">{MOVEMENT_TYPE_BADGES.OUTBOUND.label}</option>
          <option value="AUTO_DEDUCTION">{MOVEMENT_TYPE_BADGES.AUTO_DEDUCTION.label}</option>
        </select>
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          className="h-8 min-w-70 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Search movements"
        />
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {isLoading && <p className="opacity-80">Loading…</p>}

      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>{itemColumnHeader}</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Person</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMovements.map(movement => {
            const badge =
              MOVEMENT_TYPE_BADGES[movement.type as MovementType] ??
              { badgeClass: 'badge-grau', label: movement.type }
            const personEmail = movement.user_id
              ? emailById.get(movement.user_id) ?? movement.user_id
              : ''
            return (
              <TableRow key={movement.id}>
                <TableCell>{formatDateTimeDe(movement.created_at)}</TableCell>
                <TableCell className="font-semibold">{movement.itemLabel}</TableCell>
                <TableCell>
                  <span className={`badge ${badge.badgeClass}`}>{badge.label}</span>
                </TableCell>
                <TableCell>{movement.quantity}</TableCell>
                <TableCell className="opacity-90">{movement.note ?? ''}</TableCell>
                <TableCell className="opacity-85">{personEmail}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
