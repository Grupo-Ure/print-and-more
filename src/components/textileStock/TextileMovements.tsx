import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useTextileMovements } from '../../queries/textileStockQueries'
import { stockMovementFields } from '../../services/stockService'
import { MovementsView, type StockMovementEntry } from '../stock/MovementsView'
import { useTextileStockUi } from './useTextileStockUi'

export function TextileMovements() {
  const {
    movementTypeFilter,
    setMovementTypeFilter,
    movementSearch,
    setMovementSearch,
  } = useTextileStockUi()

  const movementsQuery = useTextileMovements()

  const movements = useMemo<StockMovementEntry[]>(
    () =>
      (movementsQuery.data ?? []).map(entry => {
        const variant = entry.textile_variants
        const model = variant?.textile_models
        const labelParts = [
          [model?.textile_brands?.name, model?.name].filter(Boolean).join(' '),
          variant?.color,
          variant?.size,
        ].filter(Boolean)
        return {
          id: entry.id,
          created_at: entry.created_at,
          itemLabel: labelParts.join(' · '),
          ...stockMovementFields(entry),
          user_id: entry.user_id,
        }
      }),
    [movementsQuery.data],
  )

  return (
    <MovementsView
      movements={movements}
      isLoading={movementsQuery.isLoading}
      error={movementsQuery.isError ? errorToString(movementsQuery.error) : null}
      onRefresh={() => void movementsQuery.refetch()}
      itemColumnHeader="Variant"
      searchPlaceholder="Search brand, model, colour…"
      typeFilter={movementTypeFilter}
      onTypeFilterChange={setMovementTypeFilter}
      search={movementSearch}
      onSearchChange={setMovementSearch}
    />
  )
}
