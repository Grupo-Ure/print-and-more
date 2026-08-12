import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reorder list</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <CopyReorderButton
            clipboardText={clipboardText}
            disabled={isLoading || rows.length === 0}
          />
        </div>

        {error && <p className="text-destructive">{error}</p>}
        {isLoading && <p className="opacity-80">Loading…</p>}

        {!isLoading && !error && rows.length === 0 && (
          <p className="my-3 font-semibold text-green-700">All in stock — no reorder needed</p>
        )}

        {rows.length > 0 && (
          <StockTable columns={columns} rows={rows} rowKey={rowKey} className="max-h-[60vh]" />
        )}
      </DialogContent>
    </Dialog>
  )
}
