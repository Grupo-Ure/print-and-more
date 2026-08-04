/**
 * Stamp product schemas — translated field-for-field from `validateStampDetail`
 * (one schema per `type`). The stamp dimension/classic-color helpers live here
 * because they are stamp-specific; the dimension block emits a per-field
 * 'Integer > 0' on present-but-invalid, unlike the other departments.
 *
 * Model stamps (TRODAT_PRINTY / WOODEN_STAMP) also fall through the validator's
 * classic color + description `else` branch — replicated here for parity.
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import { STAMP_COLORS, REFILL_INK_COLORS } from '../../../types/stamp'
import {
  loose,
  isValidQuantity,
  parseRequiredString,
  parseEnum,
  parsePositiveInt,
  qtyOut,
  strOut,
  intMmOut,
  MSG_FORMAT_MASSE,
} from './_shared'

// Stored value strings. Colours are FK-checked against stamp_ink_colors,
// pad sizes CHECK-constrained — both stored in English.
const REFILL_INK_TYPES = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const STAMP_PAD_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const

/** Stamp width/height: OR-required positive integers + per-field present-but-invalid. */
function checkStampDimensions(width: unknown, height: unknown, context: z.RefinementCtx) {
  const parsedWidth = parsePositiveInt(width)
  const parsedHeight = parsePositiveInt(height)
  const hasEitherDimension = (parsedWidth ?? 0) > 0 || (parsedHeight ?? 0) > 0
  if (!hasEitherDimension) context.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  if (width != null && width !== '' && parsedWidth == null) context.addIssue({ code: 'custom', path: ['width'], message: 'Integer > 0' })
  if (height != null && height !== '' && parsedHeight == null) context.addIssue({ code: 'custom', path: ['height'], message: 'Integer > 0' })
}

/** Classic stamp color + description block (the validator's `else` branch). */
function checkClassicStamp(color: unknown, colorOther: unknown, description: unknown, context: z.RefinementCtx) {
  const selectedColor = parseEnum(color, STAMP_COLORS)
  if (!selectedColor) context.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (selectedColor === 'OTHER' && !parseRequiredString(colorOther)) context.addIssue({ code: 'custom', path: ['color_other'], message: 'Required' })
  if (!parseRequiredString(description)) context.addIssue({ code: 'custom', path: ['description'], message: 'Required' })
}

// --- toChild coercers (reused by the form layer) ---------------------------
type FieldValues = Record<string, unknown>
export function modelStampToChild(fields: FieldValues): Omit<TablesInsert<'trodat_printy_products'>, 'department_product_id'> {
  return { model_id: strOut(fields.model_id), color: strOut(fields.color), color_other: strOut(fields.color_other), description: strOut(fields.description) }
}
/** stand/date/other stamps share the same child columns. */
export function classicStampToChild(fields: FieldValues): Omit<TablesInsert<'stand_stamp_products'>, 'department_product_id'> {
  return { width: intMmOut(fields.width), height: intMmOut(fields.height), color: strOut(fields.color), color_other: strOut(fields.color_other), description: strOut(fields.description) }
}
export function stampPlateToChild(fields: FieldValues): Omit<TablesInsert<'stamp_plate_products'>, 'department_product_id'> {
  return { width: intMmOut(fields.width), height: intMmOut(fields.height) }
}
export function refillInkToChild(fields: FieldValues): Omit<TablesInsert<'refill_ink_products'>, 'department_product_id'> {
  return { color: strOut(fields.color), ink_type: strOut(fields.ink_type) }
}
export function inkPadToChild(fields: FieldValues): Omit<TablesInsert<'ink_pad_products'>, 'department_product_id'> {
  return { pad_size: strOut(fields.pad_size), color: strOut(fields.color) }
}
export function trodatPadToChild(fields: FieldValues): Omit<TablesInsert<'trodat_pad_products'>, 'department_product_id'> {
  return { pad_article_number: strOut(fields.pad_article_number), color: strOut(fields.color), pad_variant_id: strOut(fields.pad_variant_id) }
}

// ---------------------------------------------------------------------------
// TRODAT_PRINTY / WOODEN_STAMP — model_id + classic color/description.
// ---------------------------------------------------------------------------

export const trodatPrintySchema = loose([
  'quantity', 'model_id', 'color', 'color_other', 'description',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(fields.model_id)) context.addIssue({ code: 'custom', path: ['model_id'], message: 'Please select a stamp model' })
  checkClassicStamp(fields.color, fields.color_other, fields.description, context)
  return { quantity: qtyOut(fields.quantity), ...modelStampToChild(fields as FieldValues) }
})
export type TrodatPrintyFields = z.infer<typeof trodatPrintySchema>
true satisfies TrodatPrintyFields extends Omit<TablesInsert<'trodat_printy_products'>, 'department_product_id'> ? true : never

export const woodenStampSchema = loose([
  'quantity', 'model_id', 'color', 'color_other', 'description',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(fields.model_id)) context.addIssue({ code: 'custom', path: ['model_id'], message: 'Please select a stamp model' })
  checkClassicStamp(fields.color, fields.color_other, fields.description, context)
  return { quantity: qtyOut(fields.quantity), ...modelStampToChild(fields as FieldValues) }
})
export type WoodenStampFields = z.infer<typeof woodenStampSchema>
true satisfies WoodenStampFields extends Omit<TablesInsert<'wooden_stamp_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// STAND_STAMP / DATE_STAMP / OTHER_STAMP — dimensions + classic color/description.
// ---------------------------------------------------------------------------

export const standStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(fields.width, fields.height, context)
  checkClassicStamp(fields.color, fields.color_other, fields.description, context)
  return { quantity: qtyOut(fields.quantity), ...classicStampToChild(fields as FieldValues) }
})
export type StandStampFields = z.infer<typeof standStampSchema>
true satisfies StandStampFields extends Omit<TablesInsert<'stand_stamp_products'>, 'department_product_id'> ? true : never

export const dateStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(fields.width, fields.height, context)
  checkClassicStamp(fields.color, fields.color_other, fields.description, context)
  return { quantity: qtyOut(fields.quantity), ...classicStampToChild(fields as FieldValues) }
})
export type DateStampFields = z.infer<typeof dateStampSchema>
true satisfies DateStampFields extends Omit<TablesInsert<'date_stamp_products'>, 'department_product_id'> ? true : never

export const otherStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(fields.width, fields.height, context)
  checkClassicStamp(fields.color, fields.color_other, fields.description, context)
  return { quantity: qtyOut(fields.quantity), ...classicStampToChild(fields as FieldValues) }
})
export type OtherStampFields = z.infer<typeof otherStampSchema>
true satisfies OtherStampFields extends Omit<TablesInsert<'other_stamp_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// STAMP_PLATE — dimensions only.
// ---------------------------------------------------------------------------

export const stampPlateSchema = loose([
  'quantity', 'width', 'height',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(fields.width, fields.height, context)
  return { quantity: qtyOut(fields.quantity), ...stampPlateToChild(fields as FieldValues) }
})
export type StampPlateFields = z.infer<typeof stampPlateSchema>
true satisfies StampPlateFields extends Omit<TablesInsert<'stamp_plate_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// Consumables — REFILL_INK / INK_PAD / TRODAT_PAD.
// ---------------------------------------------------------------------------

export const refillInkSchema = loose([
  'quantity', 'color', 'ink_type',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseEnum(fields.color, REFILL_INK_COLORS)) context.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (!parseEnum(fields.ink_type, REFILL_INK_TYPES)) context.addIssue({ code: 'custom', path: ['ink_type'], message: 'Required' })
  return { quantity: qtyOut(fields.quantity), ...refillInkToChild(fields as FieldValues) }
})
export type RefillInkFields = z.infer<typeof refillInkSchema>
true satisfies RefillInkFields extends Omit<TablesInsert<'refill_ink_products'>, 'department_product_id'> ? true : never

export const inkPadSchema = loose([
  'quantity', 'pad_size', 'color',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseEnum(fields.pad_size, STAMP_PAD_SIZES)) context.addIssue({ code: 'custom', path: ['pad_size'], message: 'Required' })
  if (!parseEnum(fields.color, REFILL_INK_COLORS)) context.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  return { quantity: qtyOut(fields.quantity), ...inkPadToChild(fields as FieldValues) }
})
export type InkPadFields = z.infer<typeof inkPadSchema>
true satisfies InkPadFields extends Omit<TablesInsert<'ink_pad_products'>, 'department_product_id'> ? true : never

export const trodatPadSchema = loose([
  'quantity', 'pad_article_number', 'color', 'pad_variant_id',
]).transform((fields, context) => {
  if (!isValidQuantity(fields.quantity)) context.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(fields.pad_article_number)) context.addIssue({ code: 'custom', path: ['pad_article_number'], message: 'Required' })
  if (!parseEnum(fields.color, REFILL_INK_COLORS)) context.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (!parseRequiredString(fields.pad_variant_id)) context.addIssue({ code: 'custom', path: ['pad_variant_id'], message: 'Select colour variant' })
  return { quantity: qtyOut(fields.quantity), ...trodatPadToChild(fields as FieldValues) }
})
export type TrodatPadFields = z.infer<typeof trodatPadSchema>
true satisfies TrodatPadFields extends Omit<TablesInsert<'trodat_pad_products'>, 'department_product_id'> ? true : never
