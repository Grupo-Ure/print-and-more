/**
 * Base product table on @tanstack/react-table + Shadcn Table. Department tables
 * compose `columns` (see `columns.tsx`) and pass action callbacks via `meta`,
 * which reach the cells through `table.options.meta`.
 */

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import type { LoadedProduct } from '../../types/product'
import type { FileRow } from '../../services/fileService'
import type { ProductFileAssignment } from '../../services/subOrderProductService'
import { actionsColumn, quantityColumn, textColumn, typeColumn } from './columns'

export type ProductTableMeta = {
  onEdit: (product: LoadedProduct) => void
  onDelete: (id: string) => void
  orderFiles: FileRow[]
  filesByProduct: Record<string, ProductFileAssignment[]>
}

export function ProductTable({
  data,
  columns,
  meta,
}: {
  data: LoadedProduct[]
  columns: ColumnDef<LoadedProduct>[]
  meta: ProductTableMeta
}) {
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable returns non-memoizable functions; React Compiler intentionally skips this component
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta,
  })

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground">No products yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(group => (
          <TableRow key={group.id}>
            {group.headers.map(header => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id} className="align-top">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialized per-department tables — each picks its columns and wraps the base.
// ─────────────────────────────────────────────────────────────────────────────

type DeptTableProps = { data: LoadedProduct[]; meta: ProductTableMeta }

const OTHER_LABELS: Record<string, string> = { OTHER: 'Other' }
const otherColumns = [typeColumn(OTHER_LABELS), quantityColumn(), textColumn('description', 'Description', 'description'), actionsColumn()]

export function OtherProductsTable({ data, meta }: DeptTableProps) {
  return <ProductTable data={data} columns={otherColumns} meta={meta} />
}
