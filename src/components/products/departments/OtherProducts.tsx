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
}

export function OtherProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)
  const editing = productEditor.mode.kind === 'edit' ? productEditor.mode.product : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Other — Details</h3>
        <p className="text-xs text-muted-foreground">For ‘Other’, PREPRESS_READY is set manually only.</p>
      </div>

      {productEditor.requiresUnlock ? (
        <Button type="button" variant="outline" onClick={productEditor.requestUnlock}>
          Unlock editing
        </Button>
      ) : (
        <OtherForm
          key={editing?.id ?? 'new'}
          subOrder={subOrder}
          subOrderStatus={subOrderStatus}
          product={editing}
          orderFiles={orderFiles}
          initialFileIds={editing ? productEditor.fileIdsFor(editing.id) : []}
          sortOrder={editing ? editing.sort_order : productEditor.products.length}
          onSaved={productEditor.handleSaved}
          onCancel={productEditor.close}
        />
      )}

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold">Products</h3>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <OtherProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, orderFiles, filesByProduct: productEditor.filesByProduct }}
          />
        )}
      </div>
    </div>
  )
}
