import { useMemo, type ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SortState } from './stockShared'

export type StockColumn<Row> = {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  /** Present ⇒ the column is sortable. */
  sortValue?: (row: Row) => string | number
  cellClassName?: string
}

type StockTableProps<Row, K extends string> = {
  columns: StockColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  sorting?: SortState<K>
  onToggleSort?: (key: K) => void
}

/**
 * Sortable data table shared by the stock views. Sorting is applied here from
 * the column's `sortValue`; filtering stays with the caller.
 */
export function StockTable<Row, K extends string>({
  columns,
  rows,
  rowKey,
  sorting,
  onToggleSort,
}: StockTableProps<Row, K>) {
  const sortedRows = useMemo(() => {
    if (!sorting) return rows
    const column = columns.find(candidate => candidate.key === sorting.key)
    if (!column?.sortValue) return rows
    const sortValue = column.sortValue
    const direction = sorting.dir === 'asc' ? 1 : -1
    return rows.slice().sort((first, second) => {
      const firstValue = sortValue(first)
      const secondValue = sortValue(second)
      if (typeof firstValue === 'number' && typeof secondValue === 'number') {
        if (firstValue !== secondValue) return (firstValue - secondValue) * direction
      } else {
        const comparison = String(firstValue).localeCompare(String(secondValue))
        if (comparison !== 0) return comparison * direction
      }
      // Stable tie-breaker so equal values keep a deterministic order.
      return rowKey(first).localeCompare(rowKey(second))
    })
  }, [rows, sorting, columns, rowKey])

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          {columns.map(column => {
            const isSortable = Boolean(column.sortValue && onToggleSort)
            const indicator =
              sorting?.key === column.key ? (sorting.dir === 'asc' ? ' ↑' : ' ↓') : ''
            return (
              <TableHead
                key={column.key}
                className={isSortable ? 'cursor-pointer select-none' : undefined}
                onClick={isSortable ? () => onToggleSort?.(column.key as K) : undefined}
                title={isSortable ? 'Sort' : undefined}
              >
                {column.header}
                {indicator}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map(row => (
          <TableRow key={rowKey(row)}>
            {columns.map(column => (
              <TableCell key={column.key} className={column.cellClassName}>
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
