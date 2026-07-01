/**
 * OTHER department "add / edit product" dialog. The OTHER department has a
 * single product type, so there is no type picker — the dialog opens straight
 * to the form for both add and edit. Submission stays in the form itself.
 */

import type { SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { OtherForm } from './forms/other'
import type { useProductEditor } from './useProductEditor'

type ProductEditor = ReturnType<typeof useProductEditor>

export function OtherProductDialog({
  editor,
  subOrder,
  orderFiles,
}: {
  editor: ProductEditor
  subOrder: SubOrderRow
  orderFiles: FileRow[]
}) {
  const { mode, close, handleSaved, fileIdsFor, products } = editor
  const subOrderStatus = subOrder.status
  const editing = mode.kind === 'edit' ? mode.product : null
  const open = mode.kind !== 'idle'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
        </DialogHeader>
        <OtherForm
          key={editing?.id ?? 'new'}
          subOrder={subOrder}
          subOrderStatus={subOrderStatus}
          product={editing}
          orderFiles={orderFiles}
          initialFileIds={editing ? fileIdsFor(editing.id) : []}
          sortOrder={editing ? editing.sort_order : products.length}
          onSaved={handleSaved}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  )
}
