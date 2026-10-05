import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { authService } from '../services/authService'
import { orderService } from '../services/orderService'
import { type Auftrag } from '../types/database'
import type { LoadedProduct } from '../types/product'
import { shortProductNumber } from '../lib/productShared'
import { PRODUCT_TYPE_LABELS } from '../lib/productTypeLabels'
import { DateInput } from './DateInput'
import { useToast } from './Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.duplicateDialog

type Props = {
  order: Auftrag
  products: LoadedProduct[]
  onSuccess: (neuerAuftrag: Auftrag) => void
  onCancel: () => void
}

/** "LFP-01 · Banner" — the product's number in this order plus what it is. */
function productLabel(product: LoadedProduct): string {
  const type = PRODUCT_TYPE_LABELS[product.type] ?? product.type
  return `${shortProductNumber(product.product_number)} · ${type}`
}

export function DuplicateDialog({ order, products, onSuccess, onCancel }: Props) {
  const activeProducts = useMemo(
    () => products.filter(product => !product.is_cancelled),
    [products],
  )

  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const product of activeProducts) initial[product.id] = true
    return initial
  })
  const [newDeadline, setNewDeadline] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showError, showSuccess } = useToast()

  const selectedProducts = useMemo(
    () => activeProducts.filter(product => selection[product.id]),
    [activeProducts, selection]
  )
  const allSelected = activeProducts.length > 0 && selectedProducts.length === activeProducts.length
  const noneSelected = selectedProducts.length === 0
  const masterChecked: boolean | 'indeterminate' = allSelected ? true : noneSelected ? false : 'indeterminate'

  const blocksDuplicate = activeProducts.length > 0 && noneSelected
  const customerLabel = order.customers?.name?.trim() || order.id

  const toggle = (id: string) => {
    setSelection(previous => ({ ...previous, [id]: !previous[id] }))
  }

  const toggleAll = (next: boolean | 'indeterminate') => {
    const target = next === true || next === 'indeterminate'
    const updated: Record<string, boolean> = {}
    for (const product of activeProducts) updated[product.id] = target
    setSelection(updated)
  }

  const handleDuplicate = async () => {
    if (busy || blocksDuplicate) return
    setBusy(true)
    setError(null)
    try {
      const newOrderId = await orderService.duplicateOrder({
        source_order_id: order.id,
        new_priority: order.priority ?? null,
        new_delivery: order.delivery ?? null,
        new_deadline: newDeadline ? newDeadline : null,
        selected_product_ids: selectedProducts.map(product => product.id),
        created_by_user_id: (await authService.getUser())?.id ?? null,
      })

      if (!newOrderId.trim()) {
        showError('Order could not be duplicated')
        return
      }

      const newOrderData = await orderService.getOrderById(newOrderId)
      if (!newOrderData) throw new Error('Duplicated order not found')

      showSuccess('Order duplicated')
      onSuccess(newOrderData)
    } catch (duplicationError) {
      showError('Order could not be duplicated')
      setError(duplicationError instanceof Error ? duplicationError.message : String(duplicationError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open && !busy) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid={IDS.root}>
        <DialogHeader>
          <DialogTitle>Duplicate Order</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Customer: <strong className="text-foreground font-medium">{customerLabel}</strong>
        </p>

        {activeProducts.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="uppercase tracking-[0.06em] text-xs text-muted-foreground">
              Products
            </h2>
            <label className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2 cursor-pointer">
              <Checkbox
                data-testid={IDS.selectAll}
                checked={masterChecked}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">
                Select all ({selectedProducts.length}/{activeProducts.length})
              </span>
            </label>
            <div className="flex flex-col gap-1 rounded-md border p-1">
              {activeProducts.map(product => (
                <label
                  key={product.id}
                  className="flex items-start gap-2.5 rounded-sm px-2.5 py-2 hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    className="mt-0.5"
                    data-testid={IDS.product}
                    data-product-id={product.id}
                    checked={!!selection[product.id]}
                    onCheckedChange={() => toggle(product.id)}
                  />
                  <span className="text-sm">{productLabel(product)}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="uppercase tracking-[0.06em] text-xs text-muted-foreground">
            New deadline (optional)
          </h2>
          <DateInput
            className="w-full h-12 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            data-testid={IDS.deadline}
            value={newDeadline}
            onChange={event => setNewDeadline(event.target.value)}
            placeholder="No deadline — set later"
          />
        </section>

        {error && <p data-testid={IDS.error} className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            data-testid={IDS.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid={IDS.submit}
            onClick={() => void handleDuplicate()}
            disabled={busy || blocksDuplicate}
          >
            {busy ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
