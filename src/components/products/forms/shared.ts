/**
 * Shared contract + helpers for the per-type product forms.
 *
 * Each per-type form (grouped in `forms/<dept>.tsx`) is a self-contained TanStack
 * Form that owns its `useSaveProduct` mutation. The type dropdown lives in the
 * department detail component, which picks which form to render.
 */

import type { OrderStatus, SubOrderRow } from '../../../types/database'
import type { LoadedProduct } from '../../../types/product'
import type { FileRow } from '../../../services/fileService'
import { validateProduct } from '../../../lib/products/registry'

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

type FieldMeta = {
  errors: Array<string | { message?: string } | undefined | null>
  isTouched?: boolean
}

/** First error message in a meta's error list (ignores touch). */
export function firstErrorMessage(errors: FieldMeta['errors']): string | undefined {
  for (const err of errors) {
    if (typeof err === 'string') return err
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message
  }
  return undefined
}

/** First error message for a touched field, or undefined (the CustomerDialog idiom). */
export function fieldError(meta: FieldMeta): string | undefined {
  if (!meta.isTouched) return undefined
  return firstErrorMessage(meta.errors)
}

/** Map a LoadedProduct to flat form values (child columns + parent quantity). */
export function valuesFromProduct(product: LoadedProduct | null): FormValues {
  if (!product) return {}
  const child = { ...(product.child as Record<string, unknown>) }
  delete child.department_product_id
  return { ...child, quantity: product.quantity, notes: product.notes }
}

/**
 * Form-level `onChange` validator: runs the central dispatcher and returns the
 * TanStack Form error shape (`{ fields }`) so each field shows its message and
 * `canSubmit` reflects validity. Returns `undefined` when valid (incl. QUOTE,
 * where `validateProduct` returns `{}`). Keeps field values raw (no schema
 * transform runs on the form state).
 */
export function productFormValidator(type: string, status: OrderStatus) {
  return ({ value }: { value: FormValues }) => {
    const errors = validateProduct(type, value, status)
    // `form: true` guarantees `canSubmit` blocks for EVERY error key — including
    // synthetic ones (`format`, `format_masse`, …) that aren't registered fields
    // and so wouldn't otherwise gate submission. `fields` drives per-field display.
    return Object.keys(errors).length > 0 ? { form: true, fields: errors } : undefined
  }
}
