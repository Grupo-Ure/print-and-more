import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useTextileMovements } from '../../queries/textileStockQueries'
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
      (movementsQuery.data ?? []).map(movement => {
        const variant = movement.textile_variants
        const product = variant?.textile_products
        const labelParts = [
          [product?.textile_brands?.name, product?.name].filter(Boolean).join(' '),
          variant?.color,
          variant?.size,
        ].filter(Boolean)
        return {
          id: movement.id,
          created_at: movement.created_at,
          itemLabel: labelParts.join(' · '),
          type: movement.type,
          quantity: movement.quantity,
          note: movement.note,
          user_id: movement.user_id,
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
      searchPlaceholder="Search brand, product, colour…"
      typeFilter={movementTypeFilter}
      onTypeFilterChange={setMovementTypeFilter}
      search={movementSearch}
      onSearchChange={setMovementSearch}
    />
  )
}
