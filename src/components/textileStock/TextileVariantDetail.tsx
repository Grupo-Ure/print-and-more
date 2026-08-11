import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { useUpdateTextileVariant } from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { useTextileVariantDelete } from './useTextileVariantDelete'
import { variantStatus } from './textileStockShared'
import type { VariantRow } from '../../services/textileMasterDataService'

type TextileVariantDetailProps = {
  variant: VariantRow
  /** Number of variants the product has (guards deleting the last one). */
  siblingCount: number
  breadcrumb: string
  onBack: () => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/** Display-only view of one variant; changes go through Edit / Delete. */
export function TextileVariantDetail({ variant, siblingCount, breadcrumb, onBack }: TextileVariantDetailProps) {
  const { showError } = useToast()
  const updateVariant = useUpdateTextileVariant()
  const deleteVariantFlow = useTextileVariantDelete()

  const [editing, setEditing] = useState(false)
  const [editColor, setEditColor] = useState('')
  const [editColorHex, setEditColorHex] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editIsSample, setEditIsSample] = useState(false)
  const [editMinimum, setEditMinimum] = useState('0')
  const [editActive, setEditActive] = useState(true)

  const status = variantStatus(variant)

  const startEditing = (): void => {
    setEditColor(variant.color)
    setEditColorHex(variant.color_hex ?? '')
    setEditSize(variant.size)
    setEditIsSample(variant.is_sample)
    setEditMinimum(String(variant.min_stock ?? 0))
    setEditActive(variant.is_active)
    setEditing(true)
  }

  const saveEdits = (): void => {
    const colorValue = editColor.trim()
    const sizeValue = editSize.trim()
    if (!colorValue || !sizeValue) {
      showError('Colour and size are required')
      return
    }
    const minimumRaw = editMinimum.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Invalid minimum stock')
      return
    }
    updateVariant.mutate(
      {
        variantId: variant.id,
        patch: {
          color: colorValue,
          color_hex: editColorHex.trim() || null,
          size: sizeValue,
          is_sample: editIsSample,
          min_stock: minimumValue,
          is_active: editActive,
        },
      },
      {
        onSuccess: () => setEditing(false),
        onError: () => showError('Variant could not be saved'),
      },
    )
  }

  const deleteVariant = async (): Promise<void> => {
    const deleted = await deleteVariantFlow(variant, siblingCount)
    if (deleted) onBack()
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Product
        </Button>
        <span className="text-sm text-muted-foreground">{breadcrumb}</span>
      </div>

      {!editing && (
        <div className="max-w-xl rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="m-0 text-sm font-semibold">
              {variant.color} / {variant.size}
            </h3>
            {variant.is_default && <span className="badge badge-grau">Default</span>}
            {variant.is_sample && <span className="badge badge-grau">Sample</span>}
            {!variant.is_active && <span className="badge badge-grau">Inactive</span>}
          </div>
          <div className="grid gap-1.5">
            <DetailRow label="Colour">
              <span className="inline-flex items-center gap-1.5">
                {variant.color_hex && (
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: variant.color_hex }}
                  />
                )}
                {variant.color}
                {variant.color_hex && <span className="text-muted-foreground">({variant.color_hex})</span>}
              </span>
            </DetailRow>
            <DetailRow label="Size">{variant.size}</DetailRow>
            <DetailRow label="Material">{variant.material || '—'}</DetailRow>
            <DetailRow label="Stock">
              <span className="inline-flex items-center gap-1.5">
                {variant.stock ?? 0}
                <span className={`badge ${status.badgeClass}`}>{status.label}</span>
              </span>
            </DetailRow>
            <DetailRow label="Min. stock">{variant.min_stock ?? 0}</DetailRow>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={startEditing}>
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={() => void deleteVariant()}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="max-w-xl rounded-lg border border-border p-3">
          <h3 className="mt-0 text-sm font-semibold">Edit variant</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-end gap-2">
            <input
              className={stockInputClass}
              value={editColor}
              onChange={event => setEditColor(event.target.value)}
              placeholder="Colour"
            />
            <input
              type="color"
              value={editColorHex || '#000000'}
              onChange={event => setEditColorHex(event.target.value)}
              className="h-8 w-11 border-none p-0"
              aria-label="Colour picker"
            />
            <input
              className={stockInputClass}
              value={editSize}
              onChange={event => setEditSize(event.target.value)}
              placeholder="Size"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={editIsSample}
                onChange={event => setEditIsSample(event.target.checked)}
              />
              Sample
            </label>
            <input
              type="number"
              className={cn(stockInputClass)}
              min={0}
              value={editMinimum}
              onChange={event => setEditMinimum(event.target.value)}
              aria-label="Minimum stock"
            />
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={editActive}
                onChange={event => setEditActive(event.target.checked)}
              />
              Active
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={saveEdits}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
