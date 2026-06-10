/** OTHER (Other department) — translated from `validateOtherDetail`. Single type;
 *  `quantity` is optional-if-present (unlike every other product type). */
import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import { loose, isQuantityValidIfPresent, parseRequiredString, qtyOut, strOut } from './_shared'

export const otherSchema = loose([
  'quantity', 'description',
]).transform((d, ctx) => {
  if (!parseRequiredString(d.description)) ctx.addIssue({ code: 'custom', path: ['description'], message: 'Required' })
  if (!isQuantityValidIfPresent(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  return {
    quantity: qtyOut(d.quantity),
    description: strOut(d.description),
  }
})

export type OtherFields = z.infer<typeof otherSchema>
true satisfies OtherFields extends Omit<TablesInsert<'other_products'>, 'department_product_id'> ? true : never
