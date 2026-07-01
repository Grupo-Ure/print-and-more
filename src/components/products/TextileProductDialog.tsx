/**
 * Textile department "add / edit garment" dialog. Textile has a single garment
 * type, so there is no type picker — the dialog opens straight to the garment
 * form for both add and edit. The reusable designs drawer stays on the page;
 * this dialog only hosts the garment form (which needs the motif list + the
 * garment's existing design links).
 */

import type { SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import type { TextileMotifRow, TextileMotifLinkInput } from '../../types/textile'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { TextileGarmentForm } from './forms/textile'
import type { useProductEditor } from './useProductEditor'

type ProductEditor = ReturnType<typeof useProductEditor>

export function TextileProductDialog({
  editor,
  subOrder,
  orderFiles,
  motifs,
  linksByProduct,
}: {
  editor: ProductEditor
  subOrder: SubOrderRow
  orderFiles: FileRow[]
  motifs: TextileMotifRow[]
  linksByProduct: Record<string, TextileMotifLinkInput[]>
}) {
  const { mode, close, handleSaved, products } = editor
  const subOrderStatus = subOrder.status
  const editing = mode.kind === 'edit' ? mode.product : null
  const open = mode.kind !== 'idle'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit garment' : 'Add garment'}</DialogTitle>
        </DialogHeader>
        <TextileGarmentForm
          key={editing?.id ?? 'new'}
          subOrder={subOrder}
          subOrderStatus={subOrderStatus}
          product={editing}
          orderFiles={orderFiles}
          initialFileIds={[]}
          sortOrder={editing ? editing.sort_order : products.length}
          onSaved={handleSaved}
          onCancel={close}
          motifs={motifs}
          initialLinks={editing ? (linksByProduct[editing.id] ?? []) : []}
        />
      </DialogContent>
    </Dialog>
  )
}
