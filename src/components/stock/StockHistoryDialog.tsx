import { useState, type ReactNode } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type StockHistoryDialogProps = {
  title: string
  /** The movement/history view rendered inside the dialog. */
  children: ReactNode
}

/**
 * History affordance shared by the stock pages: the same ghost icon button as
 * the order-history button in the orders header, opening the movement log in
 * a fixed-height dialog. The same shell is meant to host any per-page history
 * view (stock movements today, order history once that migrates).
 */
export function StockHistoryDialog({ title, children }: StockHistoryDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
      >
        <History />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[70vh] flex-col sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}
