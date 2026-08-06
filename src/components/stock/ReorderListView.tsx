import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '../Toast'
import { StockTable, type StockColumn } from './StockTable'

type ReorderListViewProps<Row> = {
  rows: Row[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  columns: StockColumn<Row>[]
  rowKey: (row: Row) => string
  /** Pipe-separated plain-text export for ordering by e-mail/phone. */
  clipboardText: string
}

/** Reorder list shared by the stock pages: toolbar, empty state, table. */
export function ReorderListView<Row>({
  rows,
  isLoading,
  error,
  onRefresh,
  columns,
  rowKey,
  clipboardText,
}: ReorderListViewProps<Row>) {
  const { showError } = useToast()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(clipboardText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showError('Copy failed')
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          Refresh
        </Button>
        <Button
          type="button"
          onClick={() => void copyToClipboard()}
          disabled={isLoading || rows.length === 0}
        >
          Copy to clipboard
        </Button>
        {copied && <span className="text-sm text-green-700">Copied</span>}
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {isLoading && <p className="opacity-80">Loading…</p>}

      {!isLoading && !error && rows.length === 0 && (
        <p className="my-3 font-semibold text-green-700">All in stock — no reorder needed</p>
      )}

      {rows.length > 0 && <StockTable columns={columns} rows={rows} rowKey={rowKey} />}
    </div>
  )
}
