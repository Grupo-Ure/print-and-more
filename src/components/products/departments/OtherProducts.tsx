/** OTHER department detail — single product type, no type dropdown. */

import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { Button } from '../../ui/button'
import { useProductEditor } from '../useProductEditor'
import { OtherForm } from '../forms/other'
import { OtherProductsTable } from '../ProductTable'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
  onProductsChanged?: (hasProducts: boolean) => void
}

export function OtherProducts({ subOrder, subOrderStatus, orderFiles = [], onProductsChanged }: Props) {
  const ed = useProductEditor(subOrder, subOrderStatus, onProductsChanged)
  const editing = ed.mode.kind === 'edit' ? ed.mode.product : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Other — Details</h3>
        <p className="text-xs text-muted-foreground">For ‘Other’, PREPRESS_READY is set manually only.</p>
      </div>

      {ed.requiresUnlock ? (
        <Button type="button" variant="outline" onClick={ed.requestUnlock}>
          Unlock editing
        </Button>
      ) : (
        <OtherForm
          key={editing?.id ?? 'new'}
          subOrder={subOrder}
          subOrderStatus={subOrderStatus}
          product={editing}
          orderFiles={orderFiles}
          initialFileIds={editing ? ed.fileIdsFor(editing.id) : []}
          sortOrder={editing ? editing.sort_order : ed.products.length}
          onSaved={ed.handleSaved}
          onCancel={ed.close}
        />
      )}

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Products</h3>
        {ed.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <OtherProductsTable
            data={ed.products}
            meta={{ onEdit: ed.openEdit, onDelete: ed.handleDelete, orderFiles, filesByProduct: ed.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
