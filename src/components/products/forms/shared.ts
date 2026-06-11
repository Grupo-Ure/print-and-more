/**
 * Shared contract + helpers for the per-type product forms.
 *
 * Each per-type form (grouped in `forms/<dept>.tsx`) is a self-contained TanStack
 * Form that owns its `useSaveProduct` mutation. The type dropdown lives in the
 * department detail component, which picks which form to render.
 */

import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { LoadedProduct, ProductChildInsert, ProductWriteInput } from '../../../types/product'
import type { FileRow } from '../../../services/fileService'

/** Props every per-type form component receives from the department detail. */
export type ProductFormProps = {
  subOrder: SubOrderRow
  subOrderStatus: OrderStatus
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
  subOrder: SubOrderRow
  type: string
  sortOrder: number
  quantity: number | null
  notes?: string | null
  child: ProductChildInsert
}): ProductWriteInput {
  return {
    ...(args.product ? { id: args.product.id } : {}),
    department_order_id: args.subOrder.id,
    department: args.subOrder.department,
    type: args.type,
    quantity: args.quantity,
    notes: args.notes ?? null,
    sort_order: args.sortOrder,
    child: args.child,
  }
}

/** Map a LoadedProduct to flat form values (child columns + parent quantity). */
export function valuesFromProduct(product: LoadedProduct | null): FormValues {
  if (!product) return {}
  const child = { ...(product.child as Record<string, unknown>) }
  delete child.department_product_id
  return { ...child, quantity: product.quantity, notes: product.notes }
}
