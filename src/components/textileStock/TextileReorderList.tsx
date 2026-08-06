import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useTextileReorderList, type TextileReorderRow } from '../../queries/textileStockQueries'
import { ReorderListView } from '../stock/ReorderListView'
import type { StockColumn } from '../stock/StockTable'
import { brandFromVariant, productNameFromVariant } from './textileStockShared'

const COLUMNS: StockColumn<TextileReorderRow>[] = [
  { key: 'brand', header: 'Brand', render: row => brandFromVariant(row) || '—' },
  {
    key: 'product',
    header: 'Product',
    render: row => productNameFromVariant(row),
    cellClassName: 'font-semibold',
  },
  { key: 'color', header: 'Colour', render: row => row.color || '—' },
  { key: 'size', header: 'Size', render: row => row.size || '—' },
  { key: 'stock', header: 'Stock', render: row => row.stock ?? 0 },
  { key: 'open', header: 'Open', render: row => row.openQuantity },
  { key: 'min_stock', header: 'Min. stock', render: row => row.min_stock ?? 0 },
  {
    key: 'order',
    header: 'Order qty',
    render: row => row.orderQuantity,
    cellClassName: 'font-bold text-destructive',
  },
]

const NO_ROWS: TextileReorderRow[] = []

export function TextileReorderList() {
  const reorderQuery = useTextileReorderList()
  const rows = reorderQuery.data ?? NO_ROWS

  const clipboardText = useMemo(() => {
    const header = 'Brand | Product | Colour | Size | Stock | Open | Min. Stock | Order qty'
    const body = rows
      .map(row =>
        [
          brandFromVariant(row),
          productNameFromVariant(row),
          row.color ?? '',
          row.size ?? '',
          row.stock ?? 0,
          row.openQuantity,
          row.min_stock ?? 0,
          row.orderQuantity,
        ].join(' | '),
      )
      .join('\n')
    return body ? `${header}\n${body}` : header
  }, [rows])

  return (
    <ReorderListView
      rows={rows}
      isLoading={reorderQuery.isLoading}
      error={reorderQuery.isError ? errorToString(reorderQuery.error) : null}
      onRefresh={() => void reorderQuery.refetch()}
      columns={COLUMNS}
      rowKey={row => row.id}
      clipboardText={clipboardText}
    />
  )
}
