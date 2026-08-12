import { createContext, useContext } from 'react'
import type { MovementType, SortState } from '../stock/stockShared'

export type OverviewSortKey =
  | 'name'
  | 'article_number'
  | 'color'
  | 'print_area'
  | 'type'
  | 'stock'
  | 'min_stock'
  | 'net_price'
  | 'status'

export type { SortState }

export type StampStockUi = {
  overviewSearch: string
  setOverviewSearch: (value: string) => void
  filterType: string
  setFilterType: (value: string) => void
  filterColor: string
  setFilterColor: (value: string) => void
  overviewSorting: SortState<OverviewSortKey>
  toggleOverviewSort: (key: OverviewSortKey) => void
  movementTypeFilter: 'ALL' | MovementType
  setMovementTypeFilter: (value: 'ALL' | MovementType) => void
  movementSearch: string
  setMovementSearch: (value: string) => void
}

export const StampStockUiContext = createContext<StampStockUi | null>(null)

export function useStampStockUi(): StampStockUi {
  const ctx = useContext(StampStockUiContext)
  if (!ctx) throw new Error('useStampStockUi must be used within a StampStockProvider')
  return ctx
}
