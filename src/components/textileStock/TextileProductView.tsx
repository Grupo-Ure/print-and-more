import { useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { useTextileVariantsByProduct, useUpdateTextileProduct } from '../../queries/textileStockQueries'
import { NeutralChip } from '../stock/StockBadge'
import { stockInputClass } from '../stock/stockShared'
import { TextileBreadcrumb, type BreadcrumbSegment } from './TextileBreadcrumb'
import { TextileVariantCreatorDialog } from './TextileVariantCreatorDialog'
import { useTextileStockUi } from './useTextileStockUi'
import { useTextileVariantDelete } from './useTextileVariantDelete'
import type { ProductRow } from '../../services/textileMasterDataService'

type EditableFieldProps = {
  label: string
  value: string | null
  onSave: (value: string | null) => void
  required?: boolean
}

/** Read-only value with a pencil that switches to an in-place input. */
function EditableField({ label, value, onSave, required = false }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const save = (): void => {
    const trimmed = draft.trim()
    if (required && !trimmed) {
      setEditing(false)
      return
    }
    setEditing(false)
    if ((trimmed || null) !== value) onSave(trimmed || null)
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      {editing ? (
        <input
          className={cn(stockInputClass, 'h-6 min-w-0 flex-1 px-1')}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={event => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') setEditing(false)
          }}
          aria-label={label}
          autoFocus
        />
      ) : (
        <>
          <span className="truncate">{value || '—'}</span>
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              setEditing(true)
            }}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            title={`Edit ${label.toLowerCase()}`}
            aria-label={`Edit ${label.toLowerCase()}`}
          >
            <Pencil className="size-3" />
          </button>
        </>
      )}
    </div>
  )
}

type TextileProductViewProps = {
  product: ProductRow
  breadcrumb: BreadcrumbSegment[]
  onBack: () => void
}

/**
 * Detail view of one product: always-visible master data (per-field in-place
 * editing) with the product's variant table underneath. Master data only —
 * stock operations live on the Stock tab; variant creation is a dialog.
 */
export function TextileProductView({ product, breadcrumb, onBack }: TextileProductViewProps) {
  const { showError } = useToast()
  const { setVariantIdForDetail } = useTextileStockUi()
  const variantsQuery = useTextileVariantsByProduct(product.id)
  const updateProduct = useUpdateTextileProduct()
  const deleteVariantFlow = useTextileVariantDelete()

  const [creatorOpen, setCreatorOpen] = useState(false)

  const variants = variantsQuery.data ?? []

  const saveField = (patch: Partial<ProductRow>): void => {
    updateProduct.mutate(
      { productId: product.id, patch },
      { onError: () => showError('Product could not be saved') },
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft />
          Products
        </Button>
        <TextileBreadcrumb segments={breadcrumb} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-1.5 rounded-lg border border-border p-3 desktop:grid-cols-2">
        <EditableField
          label="Name"
          value={product.name}
          required
          onSave={value => saveField({ name: value ?? product.name })}
        />
        <EditableField
          label="Article number"
          value={product.article_number}
          onSave={value => saveField({ article_number: value })}
        />
        <EditableField
          label="Description"
          value={product.description}
          onSave={value => saveField({ description: value })}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={product.is_active}
            onChange={event => saveField({ is_active: event.target.checked })}
          />
          Active
        </label>
      </div>

      <div className="mb-2.5">
        <Button type="button" onClick={() => setCreatorOpen(true)}>
          + Add variants
        </Button>
      </div>

      {variantsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!variantsQuery.isLoading && (
        <div className="overflow-hidden rounded-lg border">
          <Table className="text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Colour</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Colour code</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Size</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Sample</TableHead>
                <TableHead className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map(variant => (
                // Whole row opens the variant (like the orders product tables);
                // the action icons stop propagation and take priority.
                <TableRow
                  key={variant.id}
                  className="cursor-pointer"
                  onClick={() => setVariantIdForDetail(variant.id)}
                >
                  <TableCell className="px-3 py-2">
                    <button
                      type="button"
                      className="cursor-pointer font-medium hover:underline"
                      onClick={() => setVariantIdForDetail(variant.id)}
                      aria-label={`Open variant ${variant.color} ${variant.size}`}
                    >
                      {variant.color}
                    </button>
                    {variant.is_default && (
                      <span className="ml-1.5">
                        <NeutralChip label="Default" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {variant.color_hex ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block size-3.5 rounded-full border border-border"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        <span className="text-muted-foreground">{variant.color_hex}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2">{variant.size}</TableCell>
                  <TableCell className="px-3 py-2">
                    {variant.is_sample ? <NeutralChip label="Sample" /> : '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-blue-600 hover:bg-transparent hover:text-blue-800"
                        title="Edit"
                        aria-label={`Edit variant ${variant.color} ${variant.size}`}
                        onClick={event => {
                          event.stopPropagation()
                          setVariantIdForDetail(variant.id)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:bg-transparent hover:text-red-800"
                        title="Delete"
                        aria-label={`Delete variant ${variant.color} ${variant.size}`}
                        onClick={event => {
                          event.stopPropagation()
                          void deleteVariantFlow(variant, variants.length)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TextileVariantCreatorDialog
        productId={product.id}
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
      />
    </div>
  )
}
