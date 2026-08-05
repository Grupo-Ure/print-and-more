/**
 * Shared column factories for the product tables. Departments compose these
 * common columns (type / quantity / actions) with their own summary columns.
 */

import type { ColumnDef, CellContext } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import type { LoadedProduct } from '../../types/product'
import type { ProductTableMeta } from './ProductTable'

const child = (p: LoadedProduct) => (p.child ?? {}) as Record<string, unknown>
const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Type column showing the human label from a department's `*_TYPE_LABELS`. */
export function typeColumn(labels: Record<string, string>): ColumnDef<LoadedProduct> {
  return {
    id: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{labels[row.original.type] ?? row.original.type ?? '—'}</span>
    ),
  }
}

export function quantityColumn(): ColumnDef<LoadedProduct> {
  return {
    id: 'quantity',
    header: 'Quantity',
    cell: ({ row }) => <span className="tabular-nums">{String(row.original.quantity ?? '—')}</span>,
  }
}

/** A free-form text column reading a single child field (truncated). */
export function textColumn(id: string, header: string, key: string, max = 72): ColumnDef<LoadedProduct> {
  return {
    id,
    header,
    cell: ({ row }) => str(child(row.original)[key])?.slice(0, max) ?? '—',
  }
}

/** Width × height summary. */
export function formatColumn(): ColumnDef<LoadedProduct> {
  return {
    id: 'format',
    header: 'Format',
    cell: ({ row }) => {
      const c = child(row.original)
      return c.width && c.height ? `${c.width}×${c.height} mm` : '—'
    },
  }
}

/** First non-null of several child keys (e.g. material ∥ material_free_text). */
export function firstOfColumn(id: string, header: string, keys: string[], max = 60): ColumnDef<LoadedProduct> {
  return {
    id,
    header,
    cell: ({ row }) => {
      const c = child(row.original)
      for (const k of keys) {
        const v = str(c[k])
        if (v) return v.slice(0, max)
      }
      return '—'
    },
  }
}

/** Actions column: Edit / Delete + the assigned file names (reads table meta). */
export function actionsColumn(): ColumnDef<LoadedProduct> {
  return {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }: CellContext<LoadedProduct, unknown>) => {
      const meta = table.options.meta as ProductTableMeta
      const product = row.original
      const assignments = meta.filesByProduct[product.id] ?? []
      const names =
        assignments.length === 0
          ? '—'
          : assignments.map(a => meta.orderFiles.find(f => f.id === a.file_id)?.display_name ?? a.file_id).join(', ')
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-blue-600 hover:bg-transparent hover:text-blue-800 dark:text-blue-500 dark:hover:bg-transparent dark:hover:text-blue-600"
              title="Edit"
              aria-label="Edit"
              disabled={meta.isReadOnly}
              onClick={() => meta.onEdit(product)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-red-600 hover:bg-transparent hover:text-red-800 dark:text-red-500 dark:hover:bg-transparent dark:hover:text-red-600"
              title="Delete"
              aria-label="Delete"
              disabled={meta.isReadOnly}
              onClick={() => meta.onDelete(product.id)}
            >
              <Trash2 />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">{names}</span>
        </div>
      )
    },
  }
}
