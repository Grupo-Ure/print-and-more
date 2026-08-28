/**
 * Shared contract + helpers for the per-type product forms.
 *
 * Each per-type form (grouped in `forms/<dept>.tsx`) is a self-contained TanStack
 * Form that owns its `useSaveProduct` mutation. The type dropdown lives in the
 * department detail component, which picks which form to render.
 */

import { useState } from 'react'
import type { JobRow } from '../../../types/database'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../../types/product'
import type { FileRow } from '../../../services/fileService'
import { validateProduct } from '../../../lib/products/registry'
import { qtyOut } from '../../../lib/products/schemas/_shared'
import { useSaveProduct } from '../../../queries/productQueries'
import { useToast } from '../../Toast'

/** Props every per-type form component receives from the department detail. */
export type ProductFormProps = {
  job: JobRow
  /** True while the parent order is a QUOTE — nothing is required yet. */
  orderIsQuote: boolean
  /** The product being edited, or `null` when adding a new one. */
  product: LoadedProduct | null
  /** Order-level files available for assignment. */
  orderFiles: FileRow[]
  /** File ids currently assigned to the edited product (empty for new). */
  initialFileIds: string[]
  /** sort_order to persist: the product's own when editing, else the append index. */
  sortOrder: number
  /** Fired after a successful save with the fresh product list. */
  onSaved: (products: LoadedProduct[]) => void
  onCancel: () => void
}

/** Flat form values are a loose record; each form types its own via `z.infer`. */
export type FormValues = Record<string, unknown>

/** Assemble the parent `ProductWriteInput` from a form's split result. */
export function buildWriteInput(args: {
  product: LoadedProduct | null
  job: JobRow
  type: string
  sortOrder: number
  quantity: number | null
  notes?: string | null
  child: ProductChildInsert
}): ProductWriteInput {
  return {
    ...(args.product ? { id: args.product.id } : {}),
    job_id: args.job.id,
    department: args.job.department,
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
    if (Object.keys(validateProduct(type, value, p.orderIsQuote)).length > 0) return
    saveProduct.mutate(
      {
        input: buildWriteInput({ product: p.product, job: p.job, type, sortOrder: p.sortOrder, quantity: qtyOut(value.quantity), child: toChild(value) }),
        fileIds,
        jobId: p.job.id,
        orderId: p.job.order_id,
      },
      { onSuccess: ({ products }) => p.onSaved(products), onError: () => showError(p.product ? 'Product could not be saved' : 'Product could not be added') },
    )
  }
  return { fileIds, setFileIds, submit, submitting: saveProduct.isPending }
}

/** Map a LoadedProduct to flat form values (child columns + parent quantity). */
export function valuesFromProduct(product: LoadedProduct | null): FormValues {
  if (!product) return {}
  const child = { ...(product.child as Record<string, unknown>) }
  delete child.department_product_id
  return { ...child, quantity: product.quantity, notes: product.notes }
}
