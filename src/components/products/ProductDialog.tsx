/**
 * Two-step "add product" dialog shared by the multi-type departments
 * (CopyShop, LFP, Stamp, Laser): step 1 picks the product type from a list,
 * step 2 renders that type's form. In edit mode the picker is skipped — a
 * product's type is fixed — and the form opens directly.
 *
 * The dialog owns only the modal shell and the pick→form step state; the type
 * list and the per-type form components come in as inputs. Submission stays in
 * the forms themselves (each owns its mutation + Add/Cancel actions).
 */

import { useState, type ComponentType } from 'react'
import type { SubOrderRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import type { ProductFormProps } from './forms/shared'
import type { useProductEditor } from './useProductEditor'

export type ProductTypeOption = { value: string; label: string }

type ProductEditor = ReturnType<typeof useProductEditor>

export function ProductDialog({
  editor,
  subOrder,
  orderFiles,
  types,
  formByType,
}: {
  editor: ProductEditor
  subOrder: SubOrderRow
  orderFiles: FileRow[]
  types: ProductTypeOption[]
  formByType: Record<string, ComponentType<ProductFormProps>>
}) {
  const { mode, close, handleSaved, fileIdsFor, products } = editor
  const subOrderStatus = subOrder.status
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const open = mode.kind !== 'idle'

  // Every close path (save, cancel, X/overlay) clears the in-progress type so
  // the next "add" starts back at the picker.
  const handleClose = () => {
    setSelectedType(null)
    close()
  }
  const handleSavedAndClose = () => {
    setSelectedType(null)
    handleSaved()
  }

  const editing = mode.kind === 'edit' ? mode.product : null
  const type = editing ? editing.type : selectedType
  const ActiveForm = type ? formByType[type] : null
  const showPicker = mode.kind === 'add' && !selectedType

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
        </DialogHeader>

        {showPicker ? (
          <div className="flex flex-col gap-1">
            {types.map(t => (
              <button
                key={t.value}
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-primary hover:text-primary-foreground"
                onClick={() => setSelectedType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : ActiveForm ? (
          <div className="flex flex-col gap-3">
            {mode.kind === 'add' && (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedType(null)}
              >
                ← Back to types
              </button>
            )}
            <ActiveForm
              key={editing?.id ?? type ?? 'new'}
              subOrder={subOrder}
              subOrderStatus={subOrderStatus}
              product={editing}
              orderFiles={orderFiles}
              initialFileIds={editing ? fileIdsFor(editing.id) : []}
              sortOrder={editing ? editing.sort_order : products.length}
              onSaved={handleSavedAndClose}
              onCancel={handleClose}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
