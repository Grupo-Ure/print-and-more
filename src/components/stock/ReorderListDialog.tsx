import { CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyReorderButton } from './CopyReorderButton'
import { StockTable, type StockColumn } from './StockTable'

type ReorderListDialogProps<Row> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: Row[]
  isLoading: boolean
  error: string | null
  columns: StockColumn<Row>[]
  rowKey: (row: Row) => string
  /** Pipe-separated plain-text export for ordering by e-mail/phone. */
  clipboardText: string
}

/** Reorder list shared by the stock pages, shown as a dialog over the stock table. */
export function ReorderListDialog<Row>({
  open,
  onOpenChange,
  rows,
  isLoading,
  error,
  columns,
  rowKey,
  clipboardText,
}: ReorderListDialogProps<Row>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reorder list</DialogTitle>
          <DialogDescription>
            Everything below its minimum stock, with the quantity to order covering open demand.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && !error && rows.length === 0 && (
          <div className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed p-6">
            <CheckCircle2 className="size-4 shrink-0 text-green-500" />
            <p className="text-sm font-medium text-green-500">All in stock — no reorder needed.</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {rows.length} {rows.length === 1 ? 'item' : 'items'} to reorder
              </p>
              <CopyReorderButton clipboardText={clipboardText} disabled={isLoading} />
            </div>
            <StockTable
              columns={columns}
              rows={rows}
              rowKey={rowKey}
              scroll="self"
              className="max-h-[60vh]"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
