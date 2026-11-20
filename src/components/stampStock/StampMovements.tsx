import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useStampMovements } from '../../queries/stampStockQueries'
import { stockMovementFields } from '../../services/stockService'
import { MovementsView, type StockMovementEntry } from '../stock/MovementsView'
import { useStampStockUi } from './useStampStockUi'

export function StampMovements() {
  const {
    movementTypeFilter,
    setMovementTypeFilter,
    movementSearch,
    setMovementSearch,
  } = useStampStockUi()

  const movementsQuery = useStampMovements()

  const movements = useMemo<StockMovementEntry[]>(
    () =>
      (movementsQuery.data ?? []).map(entry => ({
        id: entry.id,
        created_at: entry.created_at,
        itemLabel: entry.stamp_models?.name ?? '',
        ...stockMovementFields(entry),
        user_id: entry.user_id,
      })),
    [movementsQuery.data],
  )

  return (
    <MovementsView
      movements={movements}
      isLoading={movementsQuery.isLoading}
      error={movementsQuery.isError ? errorToString(movementsQuery.error) : null}
      onRefresh={() => void movementsQuery.refetch()}
      itemColumnHeader="Model"
      searchPlaceholder="Search model…"
      typeFilter={movementTypeFilter}
      onTypeFilterChange={setMovementTypeFilter}
      search={movementSearch}
      onSearchChange={setMovementSearch}
    />
  )
}
