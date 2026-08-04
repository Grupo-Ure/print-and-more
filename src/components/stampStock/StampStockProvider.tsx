import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { MovementType } from './stampStockShared'
import { StampStockUiContext, type OverviewSortKey, type SortState, type StampStockUi } from './useStampStockUi'

/** Filter/search/sort state for the stock views — lives at page level so it survives view switches. */
export function StampStockProvider({ children }: { children: ReactNode }) {
  const [overviewSearch, setOverviewSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterColor, setFilterColor] = useState<string>('ALL')
  const [filterReorderOnly, setFilterReorderOnly] = useState(false)
  const [overviewSorting, setOverviewSorting] = useState<SortState<OverviewSortKey>>(null)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | MovementType>('ALL')
  const [movementSearch, setMovementSearch] = useState('')

  const toggleOverviewSort = useCallback((key: OverviewSortKey) => {
    setOverviewSorting(currentSorting => {
      if (!currentSorting || currentSorting.key !== key) return { key, dir: 'asc' }
      if (currentSorting.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }, [])

  const value = useMemo<StampStockUi>(
    () => ({
      overviewSearch,
      setOverviewSearch,
      filterType,
      setFilterType,
      filterColor,
      setFilterColor,
      filterReorderOnly,
      setFilterReorderOnly,
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
      filterReorderOnly,
      overviewSorting,
      toggleOverviewSort,
      movementTypeFilter,
      movementSearch,
    ],
  )

  return <StampStockUiContext.Provider value={value}>{children}</StampStockUiContext.Provider>
}
