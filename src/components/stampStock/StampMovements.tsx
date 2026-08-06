import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useStampMovements } from '../../queries/stampStockQueries'
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
      (movementsQuery.data ?? []).map(movement => ({
        id: movement.id,
        created_at: movement.created_at,
        itemLabel: movement.stamp_models?.name ?? '',
        type: movement.type,
        quantity: movement.quantity,
        note: movement.note,
        user_id: movement.user_id,
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
