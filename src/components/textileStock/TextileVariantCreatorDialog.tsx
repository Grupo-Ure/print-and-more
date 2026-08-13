import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '../Toast'
import { textileMasterDataService } from '../../services/textileMasterDataService'
import { useCreateTextileVariant } from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { VariantMatrixForm } from './VariantMatrixForm'

type TextileVariantCreatorDialogProps = {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Variant creation (colour × size matrix, or a single variant) in a dialog. */
export function TextileVariantCreatorDialog({
  productId,
  open,
  onOpenChange,
}: TextileVariantCreatorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add variants</DialogTitle>
        </DialogHeader>
        <VariantCreatorBody productId={productId} />
      </DialogContent>
    </Dialog>
  )
}

function VariantCreatorBody({ productId }: { productId: string }) {
  const { showError } = useToast()
  const createVariant = useCreateTextileVariant()

  const [singleFormOpen, setSingleFormOpen] = useState(false)
  const [newVariant, setNewVariant] = useState({
    color: '',
    color_hex: '',
    size: '',
    is_sample: false,
    min_stock: '0',
  })

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

  return (
    <div>
      <VariantMatrixForm
        productId={productId}
        singleFormShown={singleFormOpen}
        onToggleSingleForm={() => setSingleFormOpen(openState => !openState)}
      />

      {singleFormOpen && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-end gap-2 rounded-lg border border-border p-2.5">
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
              className="h-8 w-11 cursor-pointer rounded-lg border border-input bg-background p-0.5"
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
    </div>
  )
}
