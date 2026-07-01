/** OTHER department detail — single product type, add-product dialog, table. */

import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { FileRow } from '../../../services/fileService'
import { AddProductButton } from '../AddProductButton'
import { useProductEditor } from '../useProductEditor'
import { OtherProductDialog } from '../OtherProductDialog'
import { OtherProductsTable } from '../ProductTable'

type Props = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
  orderFiles?: FileRow[]
}

export function OtherProducts({ subOrder, subOrderStatus, orderFiles = [] }: Props) {
  const productEditor = useProductEditor(subOrder, subOrderStatus)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">For ‘Other’, PREPRESS_READY is set manually only.</p>

      {!productEditor.isReadOnly && (
        <OtherProductDialog
          editor={productEditor}
          subOrder={subOrder}
          orderFiles={orderFiles}
        />
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Products</h3>
          {!productEditor.isReadOnly && <AddProductButton onClick={productEditor.openAdd} />}
        </div>
        {productEditor.productsLoading ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : (
          <OtherProductsTable
            data={productEditor.products}
            meta={{ onEdit: productEditor.openEdit, onDelete: productEditor.handleDelete, onAdd: productEditor.openAdd, orderFiles, filesByProduct: productEditor.filesByProduct, isReadOnly: productEditor.isReadOnly }}
          />
        )}
      </div>
    </div>
  )
}
