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
 * History affordance shared by the stock pages: an icon button that opens the
 * movement log in a dialog. The same shell is meant to host any per-page
 * history view (stock movements today, order history once that migrates).
 */
export function StockHistoryDialog({ title, children }: StockHistoryDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={title}
        title={title}
        onClick={() => setOpen(true)}
      >
        <History />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  )
}
