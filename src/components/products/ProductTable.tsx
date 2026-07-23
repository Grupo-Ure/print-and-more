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
import type { ProductFileAssignment } from '../../services/departmentProductService'
import { AddProductButton } from './AddProductButton'
import { actionsColumn, firstOfColumn, formatColumn, quantityColumn, textColumn, typeColumn } from './columns'
import { LASER_TYPE_LABELS } from '../../types/laser'
import { LFP_TYPE_LABELS } from '../../types/lfp'
import { COPY_SHOP_TYPE_LABELS } from '../../types/copyshop'
import { STAMP_ALL_LABELS } from './forms/stampTypes'

export type ProductTableMeta = {
  onEdit: (product: LoadedProduct) => void
  onDelete: (id: string) => void
  /** Opens the add-product dialog — used from the empty state. */
  onAdd: () => void
  /** Label for the empty-state add button (defaults to "+ Add product"). */
  addLabel?: string
  orderFiles: FileRow[]
  filesByProduct: Record<string, ProductFileAssignment[]>
  /** When the job is released to production or done, edit/delete are disabled. */
  isReadOnly: boolean
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
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
        <p className="text-sm text-muted-foreground">Add the first product</p>
        {!meta.isReadOnly && <AddProductButton onClick={meta.onAdd} label={meta.addLabel} />}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="desktop:text-base">
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map(group => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map(header => (
                <TableHead
                  key={header.id}
                  className="h-9 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                >
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
                <TableCell key={cell.id} className="px-3 py-2.5 align-center">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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

const laserColumns = [
  typeColumn(LASER_TYPE_LABELS as Record<string, string>),
  quantityColumn(),
  firstOfColumn('material', 'Material', ['material', 'material_free_text']),
  textColumn('motif', 'Motif', 'motif', 48),
  actionsColumn(),
]

export function LaserProductsTable({ data, meta }: DeptTableProps) {
  return <ProductTable data={data} columns={laserColumns} meta={meta} />
}

const lfpColumns = [
  typeColumn(LFP_TYPE_LABELS as Record<string, string>),
  quantityColumn(),
  textColumn('material', 'Material', 'material'),
  formatColumn(),
  actionsColumn(),
]

export function LfpProductsTable({ data, meta }: DeptTableProps) {
  return <ProductTable data={data} columns={lfpColumns} meta={meta} />
}

const copyShopColumns = [
  typeColumn(COPY_SHOP_TYPE_LABELS as Record<string, string>),
  quantityColumn(),
  firstOfColumn('process', 'Process / Material', ['production_path', 'material']),
  formatColumn(),
  actionsColumn(),
]

export function CopyShopProductsTable({ data, meta }: DeptTableProps) {
  return <ProductTable data={data} columns={copyShopColumns} meta={meta} />
}

const stampColumns = [
  typeColumn(STAMP_ALL_LABELS),
  quantityColumn(),
  textColumn('description', 'Summary', 'description'),
  actionsColumn(),
]

export function StampProductsTable({ data, meta }: DeptTableProps) {
  return <ProductTable data={data} columns={stampColumns} meta={meta} />
}
