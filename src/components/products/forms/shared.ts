/**
 * Shared contract + helpers for the per-type product forms.
 *
 * Each per-type form (grouped in `forms/<dept>.tsx`) is a self-contained TanStack
 * Form that owns its `useSaveProduct` mutation. Which form renders is decided by
 * the product's `type`: the add dialog picks it from the chosen department's
 * type list, the Basic info tab from the product it is showing.
 */

import { useState } from 'react'
import type { Department } from '../../../types/database'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../../types/product'
import type { FileRow } from '../../../services/fileService'
import type { StockShortage } from '../../../services/productionReleaseService'
import { validateProduct } from '../../../lib/products/registry'
import { qtyOut } from '../../../lib/products/schemas/_shared'
import { useSaveProduct } from '../../../queries/productQueries'
import { useToast } from '../../Toast'

/** Props every per-type form component receives from its host. */
export type ProductFormProps = {
  /** The order the product belongs to — a product is keyed on the order now. */
  orderId: string
  /** The department of the product being written (fixed: a product never changes department). */
  department: Department
  /** The product being edited, or `null` when adding a new one. */
  product: LoadedProduct | null
  /** Order-level files available for assignment. */
  orderFiles: FileRow[]
  /** File ids currently assigned to the edited product (empty for new). */
  initialFileIds: string[]
  /** sort_order to persist: the product's own when editing, else the append index. */
  sortOrder: number
  /**
   * Shortages blocking this product's release, so the form can mark what is
   * short. Only the textile batch editor has anything to mark (its grid
   * highlights the short sizes); every other type is one line, and its shortage
   * is already stated by the production banner.
   */
  shortages?: StockShortage[]
  /** Fired after a successful save with the fresh product list and the saved id. */
  onSaved: (products: LoadedProduct[], productId: string) => void
  onCancel: () => void
}

/** Flat form values are a loose record; each form types its own via `z.infer`. */
export type FormValues = Record<string, unknown>

/** Assemble the parent `ProductWriteInput` from a form's split result. */
export function buildWriteInput(args: {
  product: LoadedProduct | null
  orderId: string
  department: Department
  type: string
  sortOrder: number
  quantity: number | null
  notes?: string | null
  child: ProductChildInsert
}): ProductWriteInput {
  return {
    ...(args.product ? { id: args.product.id } : {}),
    order_id: args.orderId,
    department: args.department,
    type: args.type,
    quantity: args.quantity,
    notes: args.notes ?? null,
    sort_order: args.sortOrder,
    child: args.child,
  }
}

/**
 * Shared submit wiring for every per-type form: owns the file-id state and the
 * `useSaveProduct` mutation, guards on `validateProduct`, builds the input from
 * the type's `toChild` coercer, and fires `onSaved` with the fresh list.
 */
export function useProductSubmit(p: ProductFormProps, type: string, toChild: (v: FormValues) => ProductChildInsert) {
  const saveProduct = useSaveProduct()
  const { showError } = useToast()
  const [fileIds, setFileIds] = useState<string[]>(p.initialFileIds)
  const submit = (value: FormValues) => {
    if (Object.keys(validateProduct(type, value)).length > 0) return
    saveProduct.mutate(
      {
        input: buildWriteInput({ product: p.product, orderId: p.orderId, department: p.department, type, sortOrder: p.sortOrder, quantity: qtyOut(value.quantity), child: toChild(value) }),
        fileIds,
        orderId: p.orderId,
      },
      { onSuccess: ({ products, productId }) => p.onSaved(products, productId), onError: () => showError(p.product ? 'Product could not be saved' : 'Product could not be added') },
    )
  }
  return { fileIds, setFileIds, submit, submitting: saveProduct.isPending }
}

/**
 * Map a LoadedProduct to flat form values (child columns + parent quantity).
 * Textile has no single child row — its batch editor reads `garments` and
 * `designs` off the product itself — so it contributes the parent fields only.
 */
export function valuesFromProduct(product: LoadedProduct | null): FormValues {
  if (!product) return {}
  const parent = { quantity: product.quantity, notes: product.notes }
  if (!('child' in product)) return parent
  const child = { ...(product.child as Record<string, unknown>) }
  delete child.product_id
  return { ...child, ...parent }
}
