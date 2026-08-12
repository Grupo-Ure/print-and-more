import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
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
  /** Extra classes for the scroll container (height comes from the flex parent). */
  className?: string
}

/** Rows rendered before the first scroll, and added per scroll chunk. */
const ROW_CHUNK = 60

/**
 * Sortable data table shared by the stock views. Sorting is applied here from
 * the column's `sortValue`; filtering stays with the caller.
 *
 * The table scrolls inside its own container (give the parent a bounded
 * height, e.g. `flex min-h-0 flex-col`): the header stays pinned while the
 * body scrolls, and rows render incrementally as the sentinel at the bottom
 * comes into view.
 */
export function StockTable<Row, K extends string>({
  columns,
  rows,
  rowKey,
  sorting,
  onToggleSort,
  className,
}: StockTableProps<Row, K>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Monotonic render budget — never reset, so filter changes don't jump the scroll.
  const [visibleCount, setVisibleCount] = useState(ROW_CHUNK)

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

  const visibleRows = visibleCount < sortedRows.length ? sortedRows.slice(0, visibleCount) : sortedRows
  const hasMore = visibleCount < sortedRows.length

  // Re-observe after every growth step: if the sentinel is still in view
  // (tall viewport, fast scroll), the fresh observation fires immediately
  // and the next chunk loads without another scroll event.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisibleCount(count => count + ROW_CHUNK)
        }
      },
      { root: containerRef.current, rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, hasMore])

  return (
    <div
      ref={containerRef}
      className={cn(
        // The ui <Table> ships its own overflow-x wrapper; neutralise it so this
        // container is the single scroll context the sticky header pins to.
        'min-h-0 flex-1 overflow-auto rounded-lg border border-border **:data-[slot=table-container]:overflow-visible',
        className,
      )}
    >
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
                  className={cn(
                    'sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]',
                    isSortable && 'cursor-pointer select-none',
                  )}
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
          {visibleRows.map(row => (
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
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
    </div>
  )
}
