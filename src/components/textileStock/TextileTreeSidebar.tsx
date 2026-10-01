import { useState } from 'react'
import { ChevronRight, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import {
  useTextileBrands,
  useTextileModelsByBrand,
  useTextileVariantsByModel,
  useUpdateTextileBrand,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { TextileCreatorDialog } from './TextileCreatorDialog'
import { variantStatus } from './textileStockShared'
import { useTextileStockUi } from './useTextileStockUi'
import type { BrandRow, TextileModelRow, VariantRow } from '../../services/textileMasterDataService'

/** Maps the shared stock status onto a small indicator dot for tree leaf rows. */
function statusDotClass(variant: VariantRow): string {
  const rank = variantStatus(variant).rank
  if (rank <= 1) return 'bg-red-500' // out of stock / reorder
  if (rank === 2) return 'bg-amber-500' // at minimum
  return 'bg-emerald-500' // OK
}

const treeRowClass =
  'flex w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted'

function ExpandChevron({ expanded, onToggle, label }: { expanded: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={expanded}
      className="w-4 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
    >
      <ChevronRight className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
    </button>
  )
}

function VariantLeafList({ modelId, onSelectVariant }: { modelId: string; onSelectVariant: (variantId: string) => void }) {
  const { variantIdForDetail } = useTextileStockUi()
  const variantsQuery = useTextileVariantsByModel(modelId)
  const variants = variantsQuery.data ?? []

  if (variantsQuery.isLoading) return <p className="pl-10 text-xs opacity-70">Loading…</p>
  if (!variants.length) return <p className="pl-10 text-xs italic text-muted-foreground">No variants yet</p>

  return (
    <ul className="m-0 list-none p-0">
      {variants.map(variant => (
        <li key={variant.id}>
          <button
            type="button"
            onClick={() => onSelectVariant(variant.id)}
            className={cn(treeRowClass, 'pl-10', variantIdForDetail === variant.id && 'bg-muted font-semibold')}
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(variant))} />
            <span className={cn('truncate', !variant.is_active && 'opacity-60')}>
              {variant.color} / {variant.size}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{variant.stock ?? 0}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ModelTreeNode({ model }: { model: TextileModelRow }) {
  const {
    modelIdForVariants,
    variantIdForDetail,
    setBrandIdForModels,
    setModelIdForVariants,
    setVariantIdForDetail,
  } = useTextileStockUi()
  const [expanded, setExpanded] = useState(model.id === modelIdForVariants)
  const isSelected = modelIdForVariants === model.id && !variantIdForDetail

  // Clicking the row behaves like a file manager: select AND toggle the folder.
  const selectModel = (): void => {
    setBrandIdForModels(model.brand_id)
    setModelIdForVariants(model.id)
    setVariantIdForDetail('')
    setExpanded(open => !open)
  }

  const selectVariant = (variantId: string): void => {
    setBrandIdForModels(model.brand_id)
    setModelIdForVariants(model.id)
    setVariantIdForDetail(variantId)
  }

  return (
    <li>
      <div className={cn(treeRowClass, 'pl-5', isSelected && 'bg-muted font-semibold')}>
        <ExpandChevron expanded={expanded} onToggle={() => setExpanded(open => !open)} label={model.name} />
        <button
          type="button"
          onClick={selectModel}
          aria-expanded={expanded}
          className={cn('min-w-0 flex-1 cursor-pointer truncate text-left', !model.is_active && 'opacity-60')}
          title={model.is_active ? model.name : `${model.name} (inactive)`}
        >
          {model.name}
        </button>
      </div>
      {expanded && <VariantLeafList modelId={model.id} onSelectVariant={selectVariant} />}
    </li>
  )
}

function BrandModelList({ brandId }: { brandId: string }) {
  const modelsQuery = useTextileModelsByBrand(brandId)
  const models = modelsQuery.data ?? []

  if (modelsQuery.isLoading) return <p className="pl-5 text-xs opacity-70">Loading…</p>
  if (!models.length) return <p className="pl-5 text-xs italic text-muted-foreground">No models yet</p>

  return (
    <ul className="m-0 list-none p-0">
      {models.map(model => (
        <ModelTreeNode key={model.id} model={model} />
      ))}
    </ul>
  )
}

function BrandTreeNode({ brand }: { brand: BrandRow }) {
  const { showError } = useToast()
  const {
    brandIdForModels,
    modelIdForVariants,
    variantIdForDetail,
    setBrandIdForModels,
    setModelIdForVariants,
    setVariantIdForDetail,
  } = useTextileStockUi()
  const updateBrand = useUpdateTextileBrand()

  const [expanded, setExpanded] = useState(brand.id === brandIdForModels)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const isSelected = brandIdForModels === brand.id && !modelIdForVariants && !variantIdForDetail

  // Clicking the row behaves like a file manager: select AND toggle the folder.
  const selectBrand = (): void => {
    setBrandIdForModels(brand.id)
    setModelIdForVariants('')
    setVariantIdForDetail('')
    setExpanded(open => !open)
  }

  const saveRename = (): void => {
    const trimmedName = editName.trim()
    if (!trimmedName || trimmedName === brand.name) {
      setEditing(false)
      return
    }
    updateBrand.mutate(
      { brandId: brand.id, patch: { name: trimmedName } },
      {
        onSuccess: () => setEditing(false),
        onError: () => showError('Brand could not be renamed'),
      },
    )
  }

  return (
    <li>
      <div className={cn(treeRowClass, 'group', isSelected && 'bg-muted font-semibold')}>
        <ExpandChevron expanded={expanded} onToggle={() => setExpanded(open => !open)} label={brand.name} />
        {editing ? (
          <input
            className={cn(stockInputClass, 'h-6 min-w-0 flex-1 px-1')}
            value={editName}
            onChange={event => setEditName(event.target.value)}
            onBlur={saveRename}
            onKeyDown={event => {
              if (event.key === 'Enter') saveRename()
              if (event.key === 'Escape') setEditing(false)
            }}
            aria-label={`Rename brand ${brand.name}`}
            autoFocus
          />
        ) : (
          <>
            <button
              type="button"
              onClick={selectBrand}
              aria-expanded={expanded}
              className={cn('min-w-0 flex-1 cursor-pointer truncate text-left', !brand.is_active && 'opacity-60')}
              title={brand.is_active ? brand.name : `${brand.name} (inactive)`}
            >
              {brand.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setEditName(brand.name)
              }}
              className="shrink-0 cursor-pointer text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              title="Rename brand"
              aria-label={`Rename brand ${brand.name}`}
            >
              <Pencil className="size-3" />
            </button>
          </>
        )}
      </div>
      {expanded && <BrandModelList brandId={brand.id} />}
    </li>
  )
}

/** Brands ▸ models ▸ variants as a file-tree — the Models tab's local sidebar. */
export function TextileTreeSidebar() {
  const brandsQuery = useTextileBrands()
  const { setBrandIdForModels, setModelIdForVariants, setVariantIdForDetail } = useTextileStockUi()

  const [creatorOpen, setCreatorOpen] = useState(false)

  return (
    <nav aria-label="Textile catalog">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catalog</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void brandsQuery.refetch()}
          disabled={brandsQuery.isFetching}
          title="Reload"
          aria-label="Reload catalog"
        >
          <RefreshCw className={cn(brandsQuery.isFetching && 'animate-spin')} />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-1.5 w-full justify-start text-muted-foreground"
        onClick={() => setCreatorOpen(true)}
      >
        + New brand
      </Button>

      <TextileCreatorDialog
        level="BRAND"
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={result => {
          // Land on whatever was created deepest.
          setBrandIdForModels(result.brandId)
          setModelIdForVariants(result.modelId ?? '')
          setVariantIdForDetail('')
        }}
      />

      {brandsQuery.isLoading && <p className="text-sm opacity-75">Loading…</p>}
      <ul className="m-0 list-none p-0">
        {(brandsQuery.data ?? []).map(brand => (
          <BrandTreeNode key={brand.id} brand={brand} />
        ))}
      </ul>
    </nav>
  )
}
