import { useMemo } from 'react'
import { errorToString } from '../../lib/errorToString'
import { useStampReorderList } from '../../queries/stampStockQueries'
import { ReorderListView } from '../stock/ReorderListView'
import type { StockColumn } from '../stock/StockTable'
import { colorLabel, typeLabel, type OrderListRow } from './stampStockShared'

const COLUMNS: StockColumn<OrderListRow>[] = [
  { key: 'name', header: 'Name', render: row => row.name, cellClassName: 'font-semibold' },
  { key: 'article_number', header: 'Article number', render: row => row.article_number ?? '—' },
  { key: 'type', header: 'Type', render: row => typeLabel(row.type), cellClassName: 'opacity-90' },
  { key: 'color', header: 'Colour', render: row => colorLabel(row.color), cellClassName: 'opacity-90' },
  { key: 'stock', header: 'Stock', render: row => row.stock },
  { key: 'open', header: 'Open orders', render: row => row.openQuantity },
  { key: 'min_stock', header: 'Min. stock', render: row => row.min_stock },
  {
    key: 'order',
    header: 'Order',
    render: row => row.orderQuantity,
    cellClassName: 'font-bold text-destructive',
  },
]

const NO_ROWS: OrderListRow[] = []

export function StampReorderList() {
  const reorderQuery = useStampReorderList()
  const rows = reorderQuery.data ?? NO_ROWS

  const clipboardText = useMemo(() => {
    const header = 'Article number | Name | Colour | Quantity'
    const body = rows
      .map(row => `${row.article_number ?? '—'} | ${row.name} | ${colorLabel(row.color)} | ${row.orderQuantity}`)
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
