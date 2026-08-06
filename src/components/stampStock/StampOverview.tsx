import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '../Toast'
import { errorToString } from '../../lib/errorToString'
import { REFILL_INK_COLORS, STAMP_COLOR_LABELS } from '../../types/stamp'
import {
  useBookStampMovement,
  useSaveStampMinimumStock,
  useStampModels,
} from '../../queries/stampStockQueries'
import { BookingField } from '../stock/BookingField'
import { MinimumStockField } from '../stock/MinimumStockField'
import { StockTable, type StockColumn } from '../stock/StockTable'
import { useStockBooking } from '../stock/useStockBooking'
import { useStampStockUi, type OverviewSortKey } from './useStampStockUi'
import {
  STAMP_TYPE_FILTER_OPTIONS,
  colorLabel,
  formatNetRetailPrice,
  statusInfo,
  typeLabel,
  type StampModelRow,
} from './stampStockShared'

type StampOverviewProps = {
  /** Booked movements are attributed to this user. */
  userId: string
}

export function StampOverview({ userId }: StampOverviewProps) {
  const { showError } = useToast()
  const {
    overviewSearch,
    setOverviewSearch,
    filterType,
    setFilterType,
    filterColor,
    setFilterColor,
    filterReorderOnly,
    setFilterReorderOnly,
    overviewSorting: sorting,
    toggleOverviewSort: toggleSort,
  } = useStampStockUi()

  const modelsQuery = useStampModels()
  const bookMovement = useBookStampMovement()
  const saveMinimumStock = useSaveStampMinimumStock()

  const booking = useStockBooking(async ({ itemId, quantity, nextStock, type }) => {
    try {
      await bookMovement.mutateAsync({ modelId: itemId, quantity, nextStock, type, userId })
    } catch (error) {
      showError('Booking failed')
      throw error
    }
  })

  const filteredModels = useMemo(() => {
    let list = (modelsQuery.data ?? []).slice()
    if (filterType !== 'ALL') list = list.filter(model => model.type === filterType)
    if (filterColor !== 'ALL' && (filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT')) {
      list = list.filter(model => model.color === filterColor)
    }
    if (filterReorderOnly) {
      list = list.filter(model => (model.stock ?? 0) <= (model.min_stock ?? 0))
    }
    const searchQuery = overviewSearch.trim().toLowerCase()
    if (searchQuery) {
      list = list.filter(model => {
        const name = String(model.name ?? '').toLowerCase()
        const articleNumber = String(model.article_number ?? '').toLowerCase()
        return name.includes(searchQuery) || articleNumber.includes(searchQuery)
      })
    }
    // Default order while no column sort is active: worst status first.
    if (!sorting) {
      list.sort((firstModel, secondModel) => {
        const firstStatus = statusInfo(firstModel)
        const secondStatus = statusInfo(secondModel)
        if (firstStatus.rank !== secondStatus.rank) return firstStatus.rank - secondStatus.rank
        return firstModel.name.localeCompare(secondModel.name)
      })
    }
    return list
  }, [filterColor, filterReorderOnly, filterType, modelsQuery.data, sorting, overviewSearch])

  const columns: StockColumn<StampModelRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: model => model.name,
      render: model => model.name,
      cellClassName: 'font-semibold',
    },
    {
      key: 'color',
      header: 'Colour',
      sortValue: model => model.color ?? '',
      render: model => colorLabel(model.color),
      cellClassName: 'opacity-90',
    },
    {
      key: 'print_area',
      header: 'Print area',
      sortValue: model => model.print_area ?? '',
      render: model => model.print_area ?? '',
      cellClassName: 'opacity-85',
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: model => model.type,
      render: model => typeLabel(model.type),
      cellClassName: 'opacity-90',
    },
    {
      key: 'stock',
      header: 'Stock',
      sortValue: model => model.stock ?? 0,
      render: model => model.stock ?? 0,
    },
    {
      key: 'min_stock',
      header: 'Min. stock',
      sortValue: model => model.min_stock ?? 0,
      render: model => (
        <MinimumStockField
          currentMinimum={model.min_stock}
          onSave={minimumStock =>
            saveMinimumStock.mutate(
              { modelId: model.id, minimumStock },
              { onError: () => showError('Stock could not be updated') },
            )
          }
        />
      ),
    },
    {
      key: 'net_price',
      header: 'Net price',
      render: model => formatNetRetailPrice(model.net_price),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: model => statusInfo(model).rank,
      render: model => {
        const status = statusInfo(model)
        return (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`badge ${status.badgeClass}`}>{status.label}</span>
            <BookingField item={model} booking={booking} />
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Name or article number…"
          value={overviewSearch}
          onChange={event => setOverviewSearch(event.target.value)}
          aria-label="Search name or article number"
          className="h-8 min-w-55 max-w-80 rounded-lg border border-input bg-background px-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterReorderOnly}
            onChange={event => setFilterReorderOnly(event.target.checked)}
          />
          Only reorder
        </label>
        <select
          value={filterType}
          onChange={event => {
            const selectedValue = event.target.value
            setFilterType(selectedValue)
            if (selectedValue !== 'TRODAT_PAD' && selectedValue !== 'INK_PAD_PRODUCT') setFilterColor('ALL')
          }}
          className="h-8 max-w-65 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Filter type"
        >
          <option value="ALL">All types</option>
          {STAMP_TYPE_FILTER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {(filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT') && (
          <select
            value={filterColor}
            onChange={event => setFilterColor(event.target.value)}
            className="h-8 max-w-50 rounded-lg border border-input bg-background px-2 text-sm"
            aria-label="Filter colour"
          >
            <option value="ALL">All colours</option>
            {REFILL_INK_COLORS.map(colorCode => (
              <option key={colorCode} value={colorCode}>
                {STAMP_COLOR_LABELS[colorCode]}
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => void modelsQuery.refetch()}
          disabled={modelsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      {modelsQuery.isError && <p className="text-destructive">{errorToString(modelsQuery.error)}</p>}
      {modelsQuery.isLoading && <p className="opacity-80">Loading…</p>}

      <StockTable<StampModelRow, OverviewSortKey>
        columns={columns}
        rows={filteredModels}
        rowKey={model => model.id}
        sorting={sorting}
        onToggleSort={toggleSort}
      />
    </div>
  )
}
