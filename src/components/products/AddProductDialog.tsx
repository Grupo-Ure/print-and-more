/**
 * The add-product dialog: department → type → form.
 *
 * A product's spec is what makes it a product, so it is created through its
 * type's own validated form — the same form the Basic info tab then edits in
 * place. The department comes from the button that opened the dialog, the type
 * from the picker (skipped for the single-type departments), and the form's
 * save creates the row; the caller selects it.
 */

import { useState } from 'react'
import type { Department } from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { departmentLabel } from '../../lib/departmentLabels'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { PRODUCT_TYPES_BY_DEPARTMENT } from '../../lib/productTypeLabels'
import { FORM_BY_TYPE } from './productTypes'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productList.addDialog

export function AddProductDialog({
  orderId,
  department,
  orderFiles,
  sortOrder,
  onCreated,
  onClose,
}: {
  orderId: string
  /** The department whose button opened the dialog; `null` keeps it closed. */
  department: Department | null
  orderFiles: FileRow[]
  /** Append index for the new product's `sort_order`. */
  sortOrder: number
  onCreated: (productId: string) => void
  onClose: () => void
}) {
  const types = department ? PRODUCT_TYPES_BY_DEPARTMENT[department] : []
  // A single-type department has nothing to pick, so it opens on its form.
  const onlyType = types.length === 1 ? types[0].value : null
  const [pickedType, setPickedType] = useState<string | null>(null)
  const type = pickedType ?? onlyType
  const ActiveForm = type ? FORM_BY_TYPE[type] : null

  const close = () => {
    setPickedType(null)
    onClose()
  }

  return (
    <Dialog open={department != null} onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto"
        data-testid={IDS.root}
        data-department={department ?? undefined}
        data-type={type ?? undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {department ? `Add a ${departmentLabel(department)} product` : 'Add a product'}
          </DialogTitle>
        </DialogHeader>

        {department != null && (ActiveForm == null ? (
          <div className="flex flex-col gap-1">
            {types.map(option => (
              <button
                key={option.value}
                type="button"
                data-testid={IDS.typeOption}
                data-type={option.value}
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-primary hover:text-primary-foreground"
                onClick={() => setPickedType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* No way back for a single-type department — there was no picker. */}
            {onlyType == null && (
              <button
                type="button"
                data-testid={IDS.back}
                className="self-start text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPickedType(null)}
              >
                ← Back to types
              </button>
            )}
            <ActiveForm
              key={type ?? 'new'}
              orderId={orderId}
              department={department}
              product={null}
              orderFiles={orderFiles}
              initialFileIds={[]}
              sortOrder={sortOrder}
              onSaved={(_products, productId) => {
                setPickedType(null)
                onCreated(productId)
              }}
              onCancel={close}
            />
          </div>
        ))}
      </DialogContent>
    </Dialog>
  )
}
