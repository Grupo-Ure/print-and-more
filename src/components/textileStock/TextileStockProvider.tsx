import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { nextSortState, type MovementType, type SortState } from '../stock/stockShared'
import { TextileStockUiContext, type StockSortKey, type TextileStockUi } from './useTextileStockUi'

/** Filter/search/sort/drill-down state — lives at page level so it survives tab switches. */
export function TextileStockProvider({ children }: { children: ReactNode }) {
  const [brandIdForProducts, setBrandIdForProducts] = useState('')
  const [productIdForVariants, setProductIdForVariants] = useState('')
  const [variantIdForDetail, setVariantIdForDetail] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [stockBrandFilter, setStockBrandFilter] = useState('ALL')
  const [filterSamplesOnly, setFilterSamplesOnly] = useState(false)
  const [stockSorting, setStockSorting] = useState<SortState<StockSortKey>>(null)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL')
  const [movementSearch, setMovementSearch] = useState('')

  const toggleStockSort = useCallback((key: StockSortKey) => {
    setStockSorting(currentSorting => nextSortState(currentSorting, key))
  }, [])

  const value = useMemo<TextileStockUi>(
    () => ({
      brandIdForProducts,
      setBrandIdForProducts,
      productIdForVariants,
      setProductIdForVariants,
      variantIdForDetail,
      setVariantIdForDetail,
      stockSearch,
      setStockSearch,
      stockBrandFilter,
      setStockBrandFilter,
      filterSamplesOnly,
      setFilterSamplesOnly,
      stockSorting,
      toggleStockSort,
      movementTypeFilter,
      setMovementTypeFilter,
      movementSearch,
      setMovementSearch,
    }),
    [
      brandIdForProducts,
      productIdForVariants,
      variantIdForDetail,
      stockSearch,
      stockBrandFilter,
      filterSamplesOnly,
      stockSorting,
      toggleStockSort,
      movementTypeFilter,
      movementSearch,
    ],
  )

  return <TextileStockUiContext.Provider value={value}>{children}</TextileStockUiContext.Provider>
}
