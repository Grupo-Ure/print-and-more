import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTimeDe } from '../../lib/formatDate'
import { useUsers } from '../../queries/userQueries'
import { MovementTypeBadge } from './StockBadge'
import { StockTable, type StockColumn } from './StockTable'
import { MOVEMENT_TYPE_BADGES, stockInputClass, type MovementType } from './stockShared'

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

  const columns: StockColumn<StockMovementEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      render: movement => formatDateTimeDe(movement.created_at),
      cellClassName: 'text-muted-foreground tabular-nums',
    },
    {
      key: 'item',
      header: itemColumnHeader,
      render: movement => movement.itemLabel,
      cellClassName: 'font-medium',
    },
    {
      key: 'type',
      header: 'Type',
      render: movement => <MovementTypeBadge type={movement.type} />,
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: movement => movement.quantity,
    },
    {
      key: 'note',
      header: 'Note',
      render: movement => (
        <span className="block max-w-96 truncate" title={movement.note ?? undefined}>
          {movement.note ?? ''}
        </span>
      ),
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'person',
      header: 'Person',
      render: movement =>
        movement.user_id ? emailById.get(movement.user_id) ?? movement.user_id : '',
      cellClassName: 'text-muted-foreground',
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
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
          className={cn(stockInputClass, 'max-w-55')}
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
          className={cn(stockInputClass, 'min-w-70')}
          aria-label="Search movements"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh"
          aria-label="Refresh movements"
        >
          <RefreshCw className={cn(isLoading && 'animate-spin')} />
        </Button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <StockTable
        columns={columns}
        rows={filteredMovements}
        rowKey={movement => movement.id}
        scroll="self"
        emptyMessage={isLoading ? 'Loading…' : 'No stock movements yet.'}
      />
    </div>
  )
}
