import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { nextSortState, type MovementType, type SortState } from '../stock/stockShared'
import { TextileStockUiContext, type StockSortKey, type TextileStockUi } from './useTextileStockUi'

/** Filter/search/sort/drill-down state — lives at page level so it survives tab switches. */
export function TextileStockProvider({ children }: { children: ReactNode }) {
  const [brandIdForModels, setBrandIdForModels] = useState('')
  const [modelIdForVariants, setModelIdForVariants] = useState('')
  const [variantIdForDetail, setVariantIdForDetail] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [stockBrandFilter, setStockBrandFilter] = useState('ALL')
  const [filterWithSamples, setFilterWithSamples] = useState(false)
  const [stockSorting, setStockSorting] = useState<SortState<StockSortKey>>(null)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL')
  const [movementSearch, setMovementSearch] = useState('')

  const toggleStockSort = useCallback((key: StockSortKey) => {
    setStockSorting(currentSorting => nextSortState(currentSorting, key))
  }, [])

  const value = useMemo<TextileStockUi>(
    () => ({
      brandIdForModels,
      setBrandIdForModels,
      modelIdForVariants,
      setModelIdForVariants,
      variantIdForDetail,
      setVariantIdForDetail,
      stockSearch,
      setStockSearch,
      stockBrandFilter,
      setStockBrandFilter,
      filterWithSamples,
      setFilterWithSamples,
      stockSorting,
      toggleStockSort,
      movementTypeFilter,
      setMovementTypeFilter,
      movementSearch,
      setMovementSearch,
    }),
    [
      brandIdForModels,
      modelIdForVariants,
      variantIdForDetail,
      stockSearch,
      stockBrandFilter,
      filterWithSamples,
      stockSorting,
      toggleStockSort,
      movementTypeFilter,
      movementSearch,
    ],
  )

  return <TextileStockUiContext.Provider value={value}>{children}</TextileStockUiContext.Provider>
}
