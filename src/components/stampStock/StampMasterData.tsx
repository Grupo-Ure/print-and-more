import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmDialog'
import { errorToString } from '../../lib/errorToString'
import { useStampMasterData, useUpdateStampModel } from '../../queries/stampStockQueries'
import { StockTable, type StockColumn } from '../stock/StockTable'
import { nextSortState, stockInputClass, type SortState } from '../stock/stockShared'
import { StampModelDialog } from './StampModelDialog'
import {
  STAMP_TYPE_FILTER_OPTIONS,
  colorLabel,
  formatNetRetailPrice,
  typeLabel,
  type StampModelRow,
} from './stampStockShared'

type MasterSortKey = 'name' | 'type' | 'article_number' | 'color' | 'net_price' | 'min_stock' | 'stock'

/** Master-data tab: create/edit/deactivate `stamp_models` catalog rows. */
export function StampMasterData() {
  const { showError } = useToast()
  const confirm = useConfirm()
  const modelsQuery = useStampMasterData()
  const updateModel = useUpdateStampModel()

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [showInactive, setShowInactive] = useState(false)
  const [sorting, setSorting] = useState<SortState<MasterSortKey>>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StampModelRow | null>(null)

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
          'The model disappears from the stock overview and the order masks. Existing orders and movement history keep it.',
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
    const searchQuery = search.trim().toLowerCase()
    if (searchQuery) {
      list = list.filter(model => {
        const name = String(model.name ?? '').toLowerCase()
        const articleNumber = String(model.article_number ?? '').toLowerCase()
        return name.includes(searchQuery) || articleNumber.includes(searchQuery)
      })
    }
    return list
  }, [modelsQuery.data, showInactive, filterType, search])

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
      key: 'type',
      header: 'Type',
      sortValue: model => model.type,
      render: model => typeLabel(model.type),
      cellClassName: 'opacity-90',
    },
    {
      key: 'article_number',
      header: 'Article no.',
      sortValue: model => model.article_number ?? '',
      render: model => model.article_number ?? '—',
      cellClassName: 'opacity-85',
    },
    {
      key: 'color',
      header: 'Colour',
      sortValue: model => model.color ?? '',
      render: model => colorLabel(model.color),
      cellClassName: 'opacity-90',
    },
    {
      key: 'details',
      header: 'Details',
      render: model => model.print_area ?? model.size ?? model.replacement_pad_article_number ?? '—',
      cellClassName: 'opacity-85',
    },
    {
      key: 'net_price',
      header: 'Net price',
      sortValue: model => model.net_price ?? 0,
      render: model => formatNetRetailPrice(model.net_price),
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
      render: model => model.min_stock ?? 0,
    },
    {
      key: 'active',
      header: 'Status',
      render: model =>
        model.is_active ? (
          <span className="badge badge-gruen">Active</span>
        ) : (
          <span className="badge badge-grau">Inactive</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: model => (
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(model)}>
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void toggleActive(model)}
            disabled={updateModel.isPending}
          >
            {model.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openCreate}>
          + New model
        </Button>
        <input
          type="search"
          placeholder="Name or article number…"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search name or article number"
          className={`${stockInputClass} min-w-55 max-w-80`}
        />
        <select
          value={filterType}
          onChange={event => setFilterType(event.target.value)}
          className={`${stockInputClass} max-w-65`}
          aria-label="Filter type"
        >
          <option value="ALL">All types</option>
          {STAMP_TYPE_FILTER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={event => setShowInactive(event.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {modelsQuery.isError && <p className="text-destructive">{errorToString(modelsQuery.error)}</p>}
      {modelsQuery.isLoading && <p className="opacity-80">Loading…</p>}

      <StockTable<StampModelRow, MasterSortKey>
        columns={columns}
        rows={filteredModels}
        rowKey={model => model.id}
        sorting={sorting}
        onToggleSort={key => setSorting(current => nextSortState(current, key))}
      />

      <StampModelDialog open={dialogOpen} onOpenChange={setDialogOpen} model={editTarget} />
    </div>
  )
}
