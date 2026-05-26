import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { orderService, type OrderListEntry } from '../services/orderService'
import { useToast } from './Toast'

type Props = {
  order: OrderListEntry
  onCancel: () => void
  onConfirmed: () => void
}

export function DeleteOrderDialog({ order, onCancel, onConfirmed }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showError, showSuccess } = useToast()

  const customerLabel = order.customers?.name?.trim() || order.order_number || order.id

  const handleDelete = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await orderService.deleteOrder(order.id)
      showSuccess('Order deleted')
      onConfirmed()
    } catch (e) {
      showError('Order could not be deleted')
      setError(e instanceof Error ? e.message : String(e))
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete order?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          You are about to permanently delete the quote for{' '}
          <strong className="text-foreground font-medium">{customerLabel}</strong>.
          All sub-orders and linked files will be removed. This cannot be undone.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
