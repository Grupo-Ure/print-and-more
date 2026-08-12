import { createContext, useContext } from 'react'
import type { MovementType, SortState } from '../stock/stockShared'

export type StockSortKey =
  | 'brand'
  | 'product'
  | 'color'
  | 'size'
  | 'sample'
  | 'stock'
  | 'min_stock'
  | 'status'

export type TextileStockUi = {
  // Master-data drill-down (Products tab) — survives tab switches.
  brandIdForProducts: string
  setBrandIdForProducts: (value: string) => void
  productIdForVariants: string
  setProductIdForVariants: (value: string) => void
  variantIdForDetail: string
  setVariantIdForDetail: (value: string) => void
  // Stock tab
  stockSearch: string
  setStockSearch: (value: string) => void
  stockBrandFilter: string
  setStockBrandFilter: (value: string) => void
  filterSamplesOnly: boolean
  setFilterSamplesOnly: (value: boolean) => void
  stockSorting: SortState<StockSortKey>
  toggleStockSort: (key: StockSortKey) => void
  // Movements tab
  movementTypeFilter: 'ALL' | MovementType
  setMovementTypeFilter: (value: 'ALL' | MovementType) => void
  movementSearch: string
  setMovementSearch: (value: string) => void
}

export const TextileStockUiContext = createContext<TextileStockUi | null>(null)

export function useTextileStockUi(): TextileStockUi {
  const ctx = useContext(TextileStockUiContext)
  if (!ctx) throw new Error('useTextileStockUi must be used within a TextileStockProvider')
  return ctx
}
