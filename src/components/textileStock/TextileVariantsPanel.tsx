import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import {
  useBookTextileMovement,
  useCreateTextileVariant,
  useSaveTextileMinimumStock,
  useTextileVariantsByProduct,
  useUpdateTextileVariant,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { BookingField } from '../stock/BookingField'
import { MinimumStockField } from '../stock/MinimumStockField'
import { useStockBooking } from '../stock/useStockBooking'
import { VariantMatrixForm } from './VariantMatrixForm'
import type { VariantRow } from './textileStockShared'

type TextileVariantsPanelProps = {
  productId: string
  breadcrumb: string
  onBack: () => void
  /** Booked movements are attributed to this user. */
  userId: string
}

/** Variant list of the selected product — step 3 of the master-data drill-down. */
export function TextileVariantsPanel({ productId, breadcrumb, onBack, userId }: TextileVariantsPanelProps) {
  const { showError } = useToast()
  const variantsQuery = useTextileVariantsByProduct(productId)
  const createVariant = useCreateTextileVariant()
  const updateVariant = useUpdateTextileVariant()
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

  const [singleFormOpen, setSingleFormOpen] = useState(false)
  const [newVariant, setNewVariant] = useState({
    color: '',
    color_hex: '',
    size: '',
    is_sample: false,
    min_stock: '0',
  })
  const [editVariant, setEditVariant] = useState<VariantRow | null>(null)
  const [editColor, setEditColor] = useState('')
  const [editColorHex, setEditColorHex] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editIsSample, setEditIsSample] = useState(false)
  const [editMinimum, setEditMinimum] = useState('0')
  const [editActive, setEditActive] = useState(true)

  const saveVariant = async (): Promise<void> => {
    const colorValue = newVariant.color.trim()
    const sizeValue = newVariant.size.trim()
    if (!colorValue || !sizeValue) {
      showError('Colour and size are required')
      return
    }
    const minimumRaw = newVariant.min_stock.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) {
      showError('Invalid minimum stock')
      return
    }
    const maxSortOrder = await textileMasterDataService.getMaxSortOrderForProduct(productId)
    createVariant.mutate(
      {
        product_id: productId,
        color: colorValue,
        color_hex: newVariant.color_hex.trim() || null,
        size: sizeValue,
        is_sample: newVariant.is_sample,
        min_stock: minimumValue,
        stock: 0,
        sort_order: (maxSortOrder ?? 0) + 1,
        is_active: true,
      },
      {
        onSuccess: () => {
          setNewVariant({ color: '', color_hex: '', size: '', is_sample: false, min_stock: '0' })
          setSingleFormOpen(false)
        },
        onError: () => showError('Variant could not be created'),
      },
    )
  }

  const saveEditedVariant = (): void => {
    if (!editVariant) return
    const colorValue = editColor.trim()
    const sizeValue = editSize.trim()
    if (!colorValue || !sizeValue) {
      showError('Colour and size are required')
      return
    }
    const minimumRaw = editMinimum.trim()
    const minimumValue = minimumRaw === '' ? 0 : parseInt(minimumRaw, 10)
    if (!Number.isInteger(minimumValue) || minimumValue < 0) return
    updateVariant.mutate(
      {
        variantId: editVariant.id,
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
        onSuccess: () => setEditVariant(null),
        onError: () => showError('Variant could not be saved'),
      },
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Products
        </Button>
        <span className="text-sm text-muted-foreground">{breadcrumb}</span>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void variantsQuery.refetch()}
          disabled={variantsQuery.isFetching}
        >
          Reload
        </Button>
      </div>

      <VariantMatrixForm
        productId={productId}
        singleFormShown={singleFormOpen}
        onToggleSingleForm={() => setSingleFormOpen(open => !open)}
      />

      {singleFormOpen && (
        <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-end gap-2 rounded-lg border border-border p-2.5">
          <input
            className={stockInputClass}
            placeholder="Colour (required)"
            value={newVariant.color}
            onChange={event => setNewVariant(state => ({ ...state, color: event.target.value }))}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Colour code</span>
            <input
              type="color"
              value={newVariant.color_hex || '#000000'}
              onChange={event => setNewVariant(state => ({ ...state, color_hex: event.target.value }))}
              className="h-8 w-11 border-none p-0"
              aria-label="Colour picker"
            />
          </div>
          <input
            className={stockInputClass}
            placeholder="Size (required)"
            value={newVariant.size}
            onChange={event => setNewVariant(state => ({ ...state, size: event.target.value }))}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={newVariant.is_sample}
              onChange={event => setNewVariant(state => ({ ...state, is_sample: event.target.checked }))}
            />
            Is sample
          </label>
          <input
            type="number"
            className={stockInputClass}
            min={0}
            value={newVariant.min_stock}
            onChange={event => setNewVariant(state => ({ ...state, min_stock: event.target.value }))}
            placeholder="Min. stock"
          />
          <Button type="button" onClick={() => void saveVariant()}>
            Save
          </Button>
        </div>
      )}

      {variantsQuery.isLoading && <p className="opacity-80">Loading…</p>}
      {!variantsQuery.isLoading && (
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Colour</TableHead>
              <TableHead>Colour code</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Sample</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Min. stock</TableHead>
              <TableHead>Edit</TableHead>
              <TableHead>Booking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(variantsQuery.data ?? []).map(variant => (
              <TableRow key={variant.id}>
                <TableCell>{variant.color}</TableCell>
                <TableCell>{variant.color_hex || '—'}</TableCell>
                <TableCell>{variant.size}</TableCell>
                <TableCell>
                  {variant.is_sample ? <span className="badge badge-grau">Sample</span> : '—'}
                </TableCell>
                <TableCell>{variant.stock ?? 0}</TableCell>
                <TableCell>
                  <MinimumStockField
                    currentMinimum={variant.min_stock}
                    onSave={minimumStock =>
                      saveMinimumStock.mutate(
                        { variantId: variant.id, minimumStock },
                        { onError: () => showError('Min. stock could not be saved') },
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditVariant(variant)
                      setEditColor(variant.color)
                      setEditColorHex(variant.color_hex ?? '')
                      setEditSize(variant.size)
                      setEditIsSample(variant.is_sample)
                      setEditMinimum(String(variant.min_stock ?? 0))
                      setEditActive(variant.is_active)
                    }}
                    aria-label={`Edit variant ${variant.color} ${variant.size}`}
                  >
                    …
                  </Button>
                </TableCell>
                <TableCell>
                  <BookingField item={variant} booking={booking} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editVariant && (
        <div className="mt-3 max-w-xl rounded-lg border border-border p-3">
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
              className={stockInputClass}
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
              <Button type="button" onClick={saveEditedVariant}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditVariant(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
