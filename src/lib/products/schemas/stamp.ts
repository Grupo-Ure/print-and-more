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

// Stored value strings (kept German — deferred value-rename pass).
const STAMP_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN', 'SONSTIGE']
const REFILL_INK_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const REFILL_INK_TYPES = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const STAMP_PAD_SIZES = ['KLEIN', 'MITTEL', 'GROSS'] as const

/** Stamp width/height: OR-required positive integers + per-field present-but-invalid. */
function checkStampDimensions(width: unknown, height: unknown, ctx: z.RefinementCtx) {
  const w = parsePositiveInt(width)
  const h = parsePositiveInt(height)
  const hasOne = (w ?? 0) > 0 || (h ?? 0) > 0
  if (!hasOne) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  if (width != null && width !== '' && w == null) ctx.addIssue({ code: 'custom', path: ['width'], message: 'Integer > 0' })
  if (height != null && height !== '' && h == null) ctx.addIssue({ code: 'custom', path: ['height'], message: 'Integer > 0' })
}

/** Classic stamp color + description block (the validator's `else` branch). */
function checkClassicStamp(color: unknown, colorOther: unknown, description: unknown, ctx: z.RefinementCtx) {
  const c = parseRequiredString(color)
  if (!c || !STAMP_COLORS.includes(c)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (c === 'SONSTIGE' && !parseRequiredString(colorOther)) ctx.addIssue({ code: 'custom', path: ['color_other'], message: 'Required' })
  if (!parseRequiredString(description)) ctx.addIssue({ code: 'custom', path: ['description'], message: 'Required' })
}

// --- toChild coercers (reused by the form layer) ---------------------------
type Vals = Record<string, unknown>
export function modelStampToChild(d: Vals): Omit<TablesInsert<'trodat_printy_products'>, 'department_product_id'> {
  return { model_id: strOut(d.model_id) }
}
/** stand/date/other stamps share the same child columns. */
export function classicStampToChild(d: Vals): Omit<TablesInsert<'stand_stamp_products'>, 'department_product_id'> {
  return { width: intMmOut(d.width), height: intMmOut(d.height), color: strOut(d.color), color_other: strOut(d.color_other), description: strOut(d.description) }
}
export function stampPlateToChild(d: Vals): Omit<TablesInsert<'stamp_plate_products'>, 'department_product_id'> {
  return { width: intMmOut(d.width), height: intMmOut(d.height) }
}
export function refillInkToChild(d: Vals): Omit<TablesInsert<'refill_ink_products'>, 'department_product_id'> {
  return { color: strOut(d.color), ink_type: strOut(d.ink_type) }
}
export function inkPadToChild(d: Vals): Omit<TablesInsert<'ink_pad_products'>, 'department_product_id'> {
  return { pad_size: strOut(d.pad_size), color: strOut(d.color) }
}
export function trodatPadToChild(d: Vals): Omit<TablesInsert<'trodat_pad_products'>, 'department_product_id'> {
  return { pad_article_number: strOut(d.pad_article_number), color: strOut(d.color), pad_variant_id: strOut(d.pad_variant_id) }
}

// ---------------------------------------------------------------------------
// TRODAT_PRINTY / WOODEN_STAMP — model_id + classic color/description.
// ---------------------------------------------------------------------------

export const trodatPrintySchema = loose([
  'quantity', 'model_id', 'color', 'color_other', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.model_id)) ctx.addIssue({ code: 'custom', path: ['model_id'], message: 'Please select a stamp model' })
  checkClassicStamp(d.color, d.color_other, d.description, ctx)
  return { quantity: qtyOut(d.quantity), ...modelStampToChild(d as Vals) }
})
export type TrodatPrintyFields = z.infer<typeof trodatPrintySchema>
true satisfies TrodatPrintyFields extends Omit<TablesInsert<'trodat_printy_products'>, 'department_product_id'> ? true : never

export const woodenStampSchema = loose([
  'quantity', 'model_id', 'color', 'color_other', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.model_id)) ctx.addIssue({ code: 'custom', path: ['model_id'], message: 'Please select a stamp model' })
  checkClassicStamp(d.color, d.color_other, d.description, ctx)
  return { quantity: qtyOut(d.quantity), ...modelStampToChild(d as Vals) }
})
export type WoodenStampFields = z.infer<typeof woodenStampSchema>
true satisfies WoodenStampFields extends Omit<TablesInsert<'wooden_stamp_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// STAND_STAMP / DATE_STAMP / OTHER_STAMP — dimensions + classic color/description.
// ---------------------------------------------------------------------------

export const standStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(d.width, d.height, ctx)
  checkClassicStamp(d.color, d.color_other, d.description, ctx)
  return { quantity: qtyOut(d.quantity), ...classicStampToChild(d as Vals) }
})
export type StandStampFields = z.infer<typeof standStampSchema>
true satisfies StandStampFields extends Omit<TablesInsert<'stand_stamp_products'>, 'department_product_id'> ? true : never

export const dateStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(d.width, d.height, ctx)
  checkClassicStamp(d.color, d.color_other, d.description, ctx)
  return { quantity: qtyOut(d.quantity), ...classicStampToChild(d as Vals) }
})
export type DateStampFields = z.infer<typeof dateStampSchema>
true satisfies DateStampFields extends Omit<TablesInsert<'date_stamp_products'>, 'department_product_id'> ? true : never

export const otherStampSchema = loose([
  'quantity', 'width', 'height', 'color', 'color_other', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(d.width, d.height, ctx)
  checkClassicStamp(d.color, d.color_other, d.description, ctx)
  return { quantity: qtyOut(d.quantity), ...classicStampToChild(d as Vals) }
})
export type OtherStampFields = z.infer<typeof otherStampSchema>
true satisfies OtherStampFields extends Omit<TablesInsert<'other_stamp_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// STAMP_PLATE — dimensions only.
// ---------------------------------------------------------------------------

export const stampPlateSchema = loose([
  'quantity', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  checkStampDimensions(d.width, d.height, ctx)
  return { quantity: qtyOut(d.quantity), ...stampPlateToChild(d as Vals) }
})
export type StampPlateFields = z.infer<typeof stampPlateSchema>
true satisfies StampPlateFields extends Omit<TablesInsert<'stamp_plate_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// Consumables — REFILL_INK / INK_PAD / TRODAT_PAD.
// ---------------------------------------------------------------------------

export const refillInkSchema = loose([
  'quantity', 'color', 'ink_type',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseEnum(d.color, REFILL_INK_COLORS)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (!parseEnum(d.ink_type, REFILL_INK_TYPES)) ctx.addIssue({ code: 'custom', path: ['ink_type'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...refillInkToChild(d as Vals) }
})
export type RefillInkFields = z.infer<typeof refillInkSchema>
true satisfies RefillInkFields extends Omit<TablesInsert<'refill_ink_products'>, 'department_product_id'> ? true : never

export const inkPadSchema = loose([
  'quantity', 'pad_size', 'color',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseEnum(d.pad_size, STAMP_PAD_SIZES)) ctx.addIssue({ code: 'custom', path: ['pad_size'], message: 'Required' })
  if (!parseEnum(d.color, REFILL_INK_COLORS)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...inkPadToChild(d as Vals) }
})
export type InkPadFields = z.infer<typeof inkPadSchema>
true satisfies InkPadFields extends Omit<TablesInsert<'ink_pad_products'>, 'department_product_id'> ? true : never

export const trodatPadSchema = loose([
  'quantity', 'pad_article_number', 'color', 'pad_variant_id',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.pad_article_number)) ctx.addIssue({ code: 'custom', path: ['pad_article_number'], message: 'Required' })
  if (!parseEnum(d.color, REFILL_INK_COLORS)) ctx.addIssue({ code: 'custom', path: ['color'], message: 'Required' })
  if (!parseRequiredString(d.pad_variant_id)) ctx.addIssue({ code: 'custom', path: ['pad_variant_id'], message: 'Select colour variant' })
  return { quantity: qtyOut(d.quantity), ...trodatPadToChild(d as Vals) }
})
export type TrodatPadFields = z.infer<typeof trodatPadSchema>
true satisfies TrodatPadFields extends Omit<TablesInsert<'trodat_pad_products'>, 'department_product_id'> ? true : never
