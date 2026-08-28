/**
 * Two-step "add product" dialog shared by the multi-type departments
 * (CopyShop, LFP, Stamp, Laser): step 1 picks the product type from a list,
 * step 2 renders that type's form. In edit/view mode the picker is skipped — a
 * product's type is fixed — and the form opens directly.
 *
 * The modal chrome and view-mode handling live in `ProductDialogShell`; this
 * component owns only the pick→form step state. Submission stays in the forms
 * themselves (each owns its mutation + Add/Cancel actions).
 */

import { useState, type ComponentType } from 'react'
import type { JobRow } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import type { ProductFormProps } from './forms/shared'
import { ProductDialogShell } from './ProductDialogShell'
import type { useProductEditor } from './useProductEditor'

export type ProductTypeOption = { value: string; label: string }

type ProductEditor = ReturnType<typeof useProductEditor>

export function ProductDialog({
  editor,
  job,
  orderFiles,
  types,
  formByType,
}: {
  editor: ProductEditor
  job: JobRow
  orderFiles: FileRow[]
  types: ProductTypeOption[]
  formByType: Record<string, ComponentType<ProductFormProps>>
}) {
  const { mode, close, handleSaved, fileIdsFor } = editor
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Every close path (save, cancel, X/overlay) clears the in-progress type so
  // the next "add" starts back at the picker.
  const clearType = () => setSelectedType(null)
  const handleClose = () => {
    clearType()
    close()
  }
  const handleSavedAndClose = () => {
    clearType()
    handleSaved()
  }

  return (
    <ProductDialogShell editor={editor} job={job} onClose={clearType}>
      {({ product, orderIsQuote, sortOrder }) => {
        const type = product ? product.type : selectedType
        const ActiveForm = type ? formByType[type] : null

        if (mode.kind === 'add' && !selectedType) {
          return (
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
          )
        }

        if (!ActiveForm) return null
        return (
          <div className="flex flex-col gap-3">
            {mode.kind === 'add' && (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground hover:text-foreground"
                onClick={clearType}
              >
                ← Back to types
              </button>
            )}
            <ActiveForm
              key={product?.id ?? type ?? 'new'}
              job={job}
              orderIsQuote={orderIsQuote}
              product={product}
              orderFiles={orderFiles}
              initialFileIds={product ? fileIdsFor(product.id) : []}
              sortOrder={sortOrder}
              onSaved={handleSavedAndClose}
              onCancel={handleClose}
            />
          </div>
        )
      }}
    </ProductDialogShell>
  )
}
