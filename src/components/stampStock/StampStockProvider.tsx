import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { nextSortState, type MovementType, type SortState } from '../stock/stockShared'
import { StampStockUiContext, type OverviewSortKey, type StampStockUi } from './useStampStockUi'

/** Filter/search/sort state for the stock views — lives at page level so it survives view switches. */
export function StampStockProvider({ children }: { children: ReactNode }) {
  const [overviewSearch, setOverviewSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterColor, setFilterColor] = useState<string>('ALL')
  const [overviewSorting, setOverviewSorting] = useState<SortState<OverviewSortKey>>(null)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL')
  const [movementSearch, setMovementSearch] = useState('')

  const toggleOverviewSort = useCallback((key: OverviewSortKey) => {
    setOverviewSorting(currentSorting => nextSortState(currentSorting, key))
  }, [])

  const value = useMemo<StampStockUi>(
    () => ({
      overviewSearch,
      setOverviewSearch,
      filterType,
      setFilterType,
      filterColor,
      setFilterColor,
      overviewSorting,
      toggleOverviewSort,
      movementTypeFilter,
      setMovementTypeFilter,
      movementSearch,
      setMovementSearch,
    }),
    [
      overviewSearch,
      filterType,
      filterColor,
      overviewSorting,
      toggleOverviewSort,
      movementTypeFilter,
      movementSearch,
    ],
  )

  return <StampStockUiContext.Provider value={value}>{children}</StampStockUiContext.Provider>
}
