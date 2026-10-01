/**
 * Which product types each department offers, and what each type is called.
 *
 * Display data, not UI: the add dialog's type picker, the duplicate dialog's
 * rows, the order history's sentences and the PDF production sheet all name a
 * type. It sits beside `roleLabels.ts` for the same reason — a label map over a
 * stored enum, read from anywhere, depending on nothing but `src/types`. The
 * form that *edits* each type stays with the forms, in
 * `components/products/productTypes.tsx`.
 */

import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { LASER_TYPES, LASER_TYPE_LABELS } from '../types/laser'
import { LFP_TYPES, LFP_TYPE_LABELS } from '../types/lfp'
import { STAMP_ALL_LABELS, STAMP_ALL_TYPES } from '../types/stamp'
import { TEXTILE_ALL_LABELS, TEXTILE_ALL_TYPES } from '../types/textile'
import { DEPARTMENTS, type Department } from '../types/database'

export type ProductTypeOption = { value: string; label: string }

const options = (
  types: readonly string[],
  labels: Record<string, string>,
): ProductTypeOption[] => types.map(type => ({ value: type, label: labels[type] ?? type }))

/** The types a department's add dialog offers, in picker order. */
export const PRODUCT_TYPES_BY_DEPARTMENT: Record<Department, ProductTypeOption[]> = {
  COPYSHOP: options(COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS),
  STAMP: options(STAMP_ALL_TYPES, STAMP_ALL_LABELS),
  LFP: options(LFP_TYPES, LFP_TYPE_LABELS),
  LASER_ENGRAVING: options(LASER_TYPES, LASER_TYPE_LABELS),
  TEXTILE: options(TEXTILE_ALL_TYPES, TEXTILE_ALL_LABELS),
  OTHER: [{ value: 'OTHER', label: 'Other' }],
}

/** Every type's label, whatever its department (history sentences, row titles). */
export const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.flatMap(department =>
    PRODUCT_TYPES_BY_DEPARTMENT[department].map(option => [option.value, option.label]),
  ),
)
