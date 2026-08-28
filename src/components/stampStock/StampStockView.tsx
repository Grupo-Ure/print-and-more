import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmDialog'
import { errorToString } from '../../lib/errorToString'
import { REFILL_INK_COLORS, STAMP_COLOR_LABELS } from '../../types/stamp'
import {
  useBookStampMovement,
  useSaveStampMinimumStock,
  useStampMasterData,
  useStampReorderList,
  useUpdateStampModel,
} from '../../queries/stampStockQueries'
import { BookingField } from '../stock/BookingField'
import { MinimumStockField } from '../stock/MinimumStockField'
import { ReorderListDialog } from '../stock/ReorderListDialog'
import { StockHistoryDialog } from '../stock/StockHistoryDialog'
import { StockStatusBadge } from '../stock/StockBadge'
import { StockTable, type StockColumn } from '../stock/StockTable'
import { StockToolbar } from '../stock/StockToolbar'
import { isStockWarning, stockInputClass } from '../stock/stockShared'
import { useStockBooking } from '../stock/useStockBooking'
import { StampModelDialog } from './StampModelDialog'
import { StampMovements } from './StampMovements'
import { useStampStockUi, type OverviewSortKey } from './useStampStockUi'
import {
  STAMP_TYPE_FILTER_OPTIONS,
  colorLabel,
  formatNetRetailPrice,
  statusInfo,
  typeLabel,
  type OrderListRow,
  type StampModelRow,
} from './stampStockShared'

const REORDER_COLUMNS: StockColumn<OrderListRow>[] = [
  { key: 'name', header: 'Name', render: row => row.name, cellClassName: 'font-semibold' },
  {
    key: 'article_number',
    header: 'Article number',
    render: row => row.article_number ?? '—',
    cellClassName: 'text-muted-foreground',
  },
  { key: 'type', header: 'Type', render: row => typeLabel(row.type) },
  { key: 'color', header: 'Colour', render: row => colorLabel(row.color) },
  { key: 'stock', header: 'Stock', align: 'right', render: row => row.stock },
  { key: 'open', header: 'Open orders', align: 'right', render: row => row.openQuantity },
  { key: 'min_stock', header: 'Min. stock', align: 'right', render: row => row.min_stock },
  {
    key: 'order',
    header: 'Order qty',
    align: 'right',
    render: row => row.orderQuantity,
    cellClassName: 'font-semibold text-red-600',
  },
]

type StampStockViewProps = {
  /** Booked movements are attributed to this user. */
  userId: string
}

/**
 * The single stamp stock table: booking + status (former Overview), master
 * data (create/edit/deactivate models), with the reorder list and the
 * movement history in dialogs.
 */
export function StampStockView({ userId }: StampStockViewProps) {
  const { showError } = useToast()
  const confirm = useConfirm()
  const {
    overviewSearch,
    setOverviewSearch,
    filterType,
    setFilterType,
    filterColor,
    setFilterColor,
    overviewSorting: sorting,
    toggleOverviewSort: toggleSort,
  } = useStampStockUi()

  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StampModelRow | null>(null)
  const [reorderOpen, setReorderOpen] = useState(false)

  const modelsQuery = useStampMasterData()
  // Only fetched while the reorder dialog is open.
  const reorderQuery = useStampReorderList(reorderOpen)
  const bookMovement = useBookStampMovement()
  const saveMinimumStock = useSaveStampMinimumStock()
  const updateModel = useUpdateStampModel()

  const booking = useStockBooking(async ({ itemId, quantity, nextStock, type }) => {
    try {
      await bookMovement.mutateAsync({ modelId: itemId, quantity, nextStock, type, userId })
    } catch (error) {
      showError('Booking failed')
      throw error
    }
  })

  const openCreate = (): void => {
    setEditTarget(null)
    setDialogOpen(true)
  }
  const openEdit = (model: StampModelRow): void => {
    setEditTarget(model)
    setDialogOpen(true)
  }

  const toggleActive = async (model: StampModelRow): Promise<void> => {
    if (model.is_active) {
      const confirmed = await confirm({
        title: `Deactivate "${model.name}"?`,
        description:
          'The model disappears from the order masks and the reorder list. Existing orders and movement history keep it.',
        confirmLabel: 'Deactivate',
        destructive: true,
      })
      if (!confirmed) return
    }
    updateModel.mutate(
      { modelId: model.id, patch: { is_active: !model.is_active } },
      { onError: () => showError('Model could not be updated') },
    )
  }

  const filteredModels = useMemo(() => {
    let list = (modelsQuery.data ?? []).slice()
    if (!showInactive) list = list.filter(model => model.is_active)
    if (filterType !== 'ALL') list = list.filter(model => model.type === filterType)
    if (filterColor !== 'ALL' && (filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT')) {
      list = list.filter(model => model.color === filterColor)
    }
    const searchQuery = overviewSearch.trim().toLowerCase()
    if (searchQuery) {
      list = list.filter(model => {
        const name = String(model.name ?? '').toLowerCase()
        const articleNumber = String(model.article_number ?? '').toLowerCase()
        return name.includes(searchQuery) || articleNumber.includes(searchQuery)
      })
    }
    // Base order: alphabetical by name — this is a lookup table. Shortages are
    // surfaced by the red row tint and the reorder list, not by ranking rows.
    list.sort((firstModel, secondModel) => firstModel.name.localeCompare(secondModel.name))
    return list
  }, [modelsQuery.data, showInactive, filterType, filterColor, overviewSearch])

  const reorderRows = useMemo(() => reorderQuery.data ?? [], [reorderQuery.data])

  const clipboardText = useMemo(() => {
    const header = 'Article number | Name | Colour | Quantity'
    const body = reorderRows
      .map(row => `${row.article_number ?? '—'} | ${row.name} | ${colorLabel(row.color)} | ${row.orderQuantity}`)
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [reorderRows])

  const columns: StockColumn<StampModelRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: model => model.name,
      render: model => (
        <span className={model.is_active ? undefined : 'opacity-50'}>{model.name}</span>
      ),
      cellClassName: 'font-semibold',
    },
    {
      key: 'article_number',
      header: 'Article no.',
      sortValue: model => model.article_number ?? '',
      render: model => model.article_number ?? '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: model => model.type,
      render: model => typeLabel(model.type),
    },
    {
      key: 'color',
      header: 'Colour',
      sortValue: model => model.color ?? '',
      render: model => colorLabel(model.color),
    },
    {
      key: 'print_area',
      header: 'Print area',
      sortValue: model => model.print_area ?? '',
      render: model => model.print_area ?? '',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: model => model.stock ?? 0,
      render: model => model.stock ?? 0,
    },
    {
      key: 'min_stock',
      header: 'Min. stock',
      align: 'right',
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
      align: 'right',
      sortValue: model => model.net_price ?? 0,
      render: model => formatNetRetailPrice(model.net_price),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: model => statusInfo(model).rank,
      render: model => <StockStatusBadge status={statusInfo(model)} />,
    },
    {
      key: 'booking',
      header: 'Update stock',
      render: model => <BookingField item={model} booking={booking} />,
    },
    {
      key: 'actions',
      header: '',
      render: model => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-blue-600 hover:bg-transparent hover:text-blue-800"
            title="Edit"
            aria-label={`Edit ${model.name}`}
            onClick={() => openEdit(model)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            title={model.is_active ? 'Deactivate' : 'Activate'}
            aria-label={`${model.is_active ? 'Deactivate' : 'Activate'} ${model.name}`}
            onClick={() => void toggleActive(model)}
            disabled={updateModel.isPending}
          >
            {model.is_active ? <Archive /> : <ArchiveRestore />}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <StockToolbar>
        <Button type="button" onClick={openCreate}>
          + New model
        </Button>
        <input
          type="search"
          placeholder="Name or article number…"
          value={overviewSearch}
          onChange={event => setOverviewSearch(event.target.value)}
          aria-label="Search name or article number"
          className={cn(stockInputClass, 'min-w-55 max-w-80')}
        />
        <Select
          value={filterType}
          onValueChange={selectedValue => {
            setFilterType(selectedValue)
            if (selectedValue !== 'TRODAT_PAD' && selectedValue !== 'INK_PAD_PRODUCT') setFilterColor('ALL')
          }}
        >
          <SelectTrigger className="w-auto max-w-65" aria-label="Filter type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {STAMP_TYPE_FILTER_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterType === 'TRODAT_PAD' || filterType === 'INK_PAD_PRODUCT') && (
          <select
            value={filterColor}
            onChange={event => setFilterColor(event.target.value)}
            className={cn(stockInputClass, 'max-w-50')}
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showInactive}
            onChange={event => setShowInactive(event.target.checked)}
          />
          Show inactive
        </label>
        <Button type="button" variant="outline" onClick={() => setReorderOpen(true)}>
          Reorder list
        </Button>
        <div className="ml-auto">
          <StockHistoryDialog title="Stock movements">
            <StampMovements />
          </StockHistoryDialog>
        </div>
      </StockToolbar>

      {modelsQuery.isError && (
        <p className="mb-2 text-sm text-destructive">{errorToString(modelsQuery.error)}</p>
      )}

      <StockTable<StampModelRow, OverviewSortKey>
        columns={columns}
        rows={filteredModels}
        rowKey={model => model.id}
        sorting={sorting}
        onToggleSort={toggleSort}
        rowClassName={model =>
          // Same red tint as the shortage rows on the orders page.
          model.is_active && isStockWarning(statusInfo(model))
            ? 'bg-red-500/10 hover:bg-red-500/15'
            : undefined
        }
        emptyMessage={modelsQuery.isLoading ? 'Loading…' : 'No stamp models match the current filters.'}
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

      <StampModelDialog open={dialogOpen} onOpenChange={setDialogOpen} model={editTarget} />
    </div>
  )
}
