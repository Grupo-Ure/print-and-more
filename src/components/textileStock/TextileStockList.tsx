import { useMemo, useState } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { errorToString } from '../../lib/errorToString'
import {
  useAllTextileVariants,
  useBookTextileMovement,
  useSaveTextileMinimumStock,
  useTextileReorderList,
  type TextileReorderRow,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { BookingField } from '../stock/BookingField'
import { MinimumStockField } from '../stock/MinimumStockField'
import { ReorderListDialog } from '../stock/ReorderListDialog'
import { StockHistoryDialog } from '../stock/StockHistoryDialog'
import { StockTable, type StockColumn } from '../stock/StockTable'
import { useStockBooking } from '../stock/useStockBooking'
import { TextileMovements } from './TextileMovements'
import { useTextileStockUi, type StockSortKey } from './useTextileStockUi'
import { brandFromVariant, productNameFromVariant, variantStatus } from './textileStockShared'
import type { VariantWithDetails } from '../../services/textileMasterDataService'

const REORDER_COLUMNS: StockColumn<TextileReorderRow>[] = [
  { key: 'brand', header: 'Brand', render: row => brandFromVariant(row) || '—' },
  {
    key: 'product',
    header: 'Product',
    render: row => productNameFromVariant(row),
    cellClassName: 'font-semibold',
  },
  { key: 'color', header: 'Colour', render: row => row.color || '—' },
  { key: 'size', header: 'Size', render: row => row.size || '—' },
  { key: 'stock', header: 'Stock', render: row => row.stock ?? 0 },
  { key: 'open', header: 'Open', render: row => row.openQuantity },
  { key: 'min_stock', header: 'Min. stock', render: row => row.min_stock ?? 0 },
  {
    key: 'order',
    header: 'Order qty',
    render: row => row.orderQuantity,
    cellClassName: 'font-bold text-destructive',
  },
]

type TextileStockListProps = {
  /** Booked movements are attributed to this user. */
  userId: string
  /** Opens the master-data subpage ("Manage brands and products"). */
  onOpenMasterData: () => void
}

/**
 * The textile stock page: every variant across all brands with filters,
 * sorting and booking; the reorder list and the movement history open as
 * dialogs. Master data lives on its own subpage behind the cog button.
 */
export function TextileStockList({ userId, onOpenMasterData }: TextileStockListProps) {
  const { showError } = useToast()
  const {
    stockSearch,
    setStockSearch,
    stockBrandFilter,
    setStockBrandFilter,
    filterSamplesOnly,
    setFilterSamplesOnly,
    stockSorting,
    toggleStockSort,
  } = useTextileStockUi()

  const [reorderOpen, setReorderOpen] = useState(false)

  const variantsQuery = useAllTextileVariants()
  // Only fetched while the reorder dialog is open.
  const reorderQuery = useTextileReorderList(reorderOpen)
  const bookMovement = useBookTextileMovement()
  const saveMinimumStock = useSaveTextileMinimumStock()

  const booking = useStockBooking(async ({ itemId, quantity, nextStock, type }) => {
    try {
      await bookMovement.mutateAsync({ variantId: itemId, quantity, nextStock, type, userId })
    } catch (error) {
      showError('Booking failed')
      throw error
    }
  })

  const brandOptions = useMemo(() => {
    const names = new Set<string>()
    for (const variant of variantsQuery.data ?? []) {
      const brand = brandFromVariant(variant)
      if (brand) names.add(brand)
    }
    return [...names].sort((first, second) => first.localeCompare(second, 'de'))
  }, [variantsQuery.data])

  const filteredVariants = useMemo(() => {
    let list = (variantsQuery.data ?? []).slice()
    if (stockBrandFilter !== 'ALL') {
      list = list.filter(variant => brandFromVariant(variant) === stockBrandFilter)
    }
    if (filterSamplesOnly) list = list.filter(variant => variant.is_sample)
    const searchQuery = stockSearch.trim().toLowerCase()
    if (searchQuery) {
      list = list.filter(variant => {
        const brandName = brandFromVariant(variant).toLowerCase()
        const productName = productNameFromVariant(variant).toLowerCase()
        const colorValue = String(variant.color ?? '').toLowerCase()
        const sizeValue = String(variant.size ?? '').toLowerCase()
        return (
          brandName.includes(searchQuery) ||
          productName.includes(searchQuery) ||
          colorValue.includes(searchQuery) ||
          sizeValue.includes(searchQuery)
        )
      })
    }
    return list
  }, [variantsQuery.data, stockBrandFilter, stockSearch, filterSamplesOnly])

  const reorderRows = useMemo(() => reorderQuery.data ?? [], [reorderQuery.data])

  const clipboardText = useMemo(() => {
    const header = 'Brand | Product | Colour | Size | Stock | Open | Min. Stock | Order qty'
    const body = reorderRows
      .map(row =>
        [
          brandFromVariant(row),
          productNameFromVariant(row),
          row.color ?? '',
          row.size ?? '',
          row.stock ?? 0,
          row.openQuantity,
          row.min_stock ?? 0,
          row.orderQuantity,
        ].join(' | '),
      )
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [reorderRows])

  const columns: StockColumn<VariantWithDetails>[] = [
    {
      key: 'brand',
      header: 'Brand',
      sortValue: brandFromVariant,
      render: brandFromVariant,
    },
    {
      key: 'product',
      header: 'Product',
      sortValue: productNameFromVariant,
      render: productNameFromVariant,
      cellClassName: 'font-semibold',
    },
    {
      key: 'color',
      header: 'Colour',
      sortValue: variant => variant.color,
      render: variant => variant.color,
    },
    {
      key: 'size',
      header: 'Size',
      sortValue: variant => variant.size,
      render: variant => variant.size,
    },
    {
      key: 'sample',
      header: 'Sample',
      sortValue: variant => (variant.is_sample ? 1 : 0),
      render: variant => (variant.is_sample ? <span className="badge badge-grau">Sample</span> : '—'),
    },
    {
      key: 'stock',
      header: 'Stock',
      sortValue: variant => variant.stock ?? 0,
      render: variant => variant.stock ?? 0,
    },
    {
      key: 'min_stock',
      header: 'Min. stock',
      sortValue: variant => variant.min_stock ?? 0,
      render: variant => (
        <MinimumStockField
          currentMinimum={variant.min_stock}
          onSave={minimumStock =>
            saveMinimumStock.mutate(
              { variantId: variant.id, minimumStock },
              { onError: () => showError('Min. stock could not be saved') },
            )
          }
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: variant => variantStatus(variant).rank,
      render: variant => {
        const status = variantStatus(variant)
        return <span className={`badge ${status.badgeClass}`}>{status.label}</span>
      },
    },
    {
      key: 'booking',
      header: 'Booking',
      render: variant => <BookingField item={variant} booking={booking} />,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Brand, product, colour, size…"
          value={stockSearch}
          onChange={event => setStockSearch(event.target.value)}
          className={cn(stockInputClass, 'min-w-55 max-w-80')}
          aria-label="Search stock"
        />
        <select
          value={stockBrandFilter}
          onChange={event => setStockBrandFilter(event.target.value)}
          className={stockInputClass}
          aria-label="Filter brand"
        >
          <option value="ALL">All brands</option>
          {brandOptions.map(brandName => (
            <option key={brandName} value={brandName}>
              {brandName}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterSamplesOnly}
            onChange={event => setFilterSamplesOnly(event.target.checked)}
          />
          Only samples
        </label>
        <Button type="button" variant="outline" onClick={() => setReorderOpen(true)}>
          Reorder list
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <StockHistoryDialog title="Stock movements">
            <TextileMovements />
          </StockHistoryDialog>
          <Button type="button" variant="outline" onClick={onOpenMasterData}>
            <Settings />
            Manage brands and products
          </Button>
        </div>
      </div>

      {variantsQuery.isError && <p className="text-destructive">{errorToString(variantsQuery.error)}</p>}
      {variantsQuery.isLoading && <p className="opacity-80">Loading…</p>}

      <StockTable<VariantWithDetails, StockSortKey>
        columns={columns}
        rows={filteredVariants}
        rowKey={variant => variant.id}
        sorting={stockSorting}
        onToggleSort={toggleStockSort}
      />

      <ReorderListDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        rows={reorderRows}
        isLoading={reorderQuery.isLoading}
        error={reorderQuery.isError ? errorToString(reorderQuery.error) : null}
        columns={REORDER_COLUMNS}
        rowKey={row => row.id}
        clipboardText={clipboardText}
      />
    </div>
  )
}
