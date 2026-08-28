/**
 * Laser-engraving product schemas — translated field-for-field from
 * `validateLaserDetail` (one schema per `type`). Sign-type dimensions use the
 * integer parser with the synthetic `format` OR-key.
 *
 * Each type also exports a `<type>ToChild` coercer (the transform's value-mapping
 * lifted out) so the form layer reuses the exact same input→child conversion.
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import {
  loose,
  isValidQuantity,
  parseRequiredString,
  requireBoolPresent,
  hasDimensionIntMm,
  qtyOut,
  strOut,
  intMmOut,
  boolOut,
  MSG_FORMAT_MASSE,
} from './_shared'

type Vals = Record<string, unknown>
const SIGN_MATERIALS = ['ABS_SW', 'ABS_WS', 'ABS_GS', 'ABS_SS', 'SONSTIGE']
const ORIGINS = ['KUNDENMATERIAL', 'EIGENMATERIAL']

// ---------------------------------------------------------------------------
// SIGN / TROPHY_PLATE — sign block, requires self_adhesive.
// ---------------------------------------------------------------------------

export function signToChild(d: Vals): Omit<TablesInsert<'sign_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    material_other: strOut(d.material_other),
    width: intMmOut(d.width),
    height: intMmOut(d.height),
    round_corners: boolOut(d.round_corners),
    self_adhesive: boolOut(d.self_adhesive),
    motif: strOut(d.motif),
  }
}

function validateSign(d: Vals, ctx: z.RefinementCtx, withSelfAdhesive: boolean) {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  const material = parseRequiredString(d.material)
  if (!material || !SIGN_MATERIALS.includes(material)) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (material === 'SONSTIGE' && !parseRequiredString(d.material_other)) ctx.addIssue({ code: 'custom', path: ['material_other'], message: 'Required' })
  if (!hasDimensionIntMm(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  if (requireBoolPresent(d.round_corners) === 'missing') ctx.addIssue({ code: 'custom', path: ['round_corners'], message: 'Required' })
  if (withSelfAdhesive && requireBoolPresent(d.self_adhesive) === 'missing') ctx.addIssue({ code: 'custom', path: ['self_adhesive'], message: 'Required' })
  if (!parseRequiredString(d.motif)) ctx.addIssue({ code: 'custom', path: ['motif'], message: 'Required' })
}

export const signSchema = loose([
  'quantity', 'material', 'material_other', 'width', 'height', 'round_corners', 'self_adhesive', 'motif',
]).transform((d, ctx) => {
  validateSign(d as Vals, ctx, true)
  return { quantity: qtyOut(d.quantity), ...signToChild(d as Vals) }
})
export type SignFields = z.infer<typeof signSchema>
true satisfies SignFields extends Omit<TablesInsert<'sign_products'>, 'department_product_id'> ? true : never

export function trophyPlateToChild(d: Vals): Omit<TablesInsert<'trophy_plate_products'>, 'department_product_id'> {
  return signToChild(d)
}

export const trophyPlateSchema = loose([
  'quantity', 'material', 'material_other', 'width', 'height', 'round_corners', 'self_adhesive', 'motif',
]).transform((d, ctx) => {
  validateSign(d as Vals, ctx, true)
  return { quantity: qtyOut(d.quantity), ...trophyPlateToChild(d as Vals) }
})
export type TrophyPlateFields = z.infer<typeof trophyPlateSchema>
true satisfies TrophyPlateFields extends Omit<TablesInsert<'trophy_plate_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// NAME_TAG — sign block, no self_adhesive.
// ---------------------------------------------------------------------------

export function nameTagToChild(d: Vals): Omit<TablesInsert<'name_tag_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    material_other: strOut(d.material_other),
    width: intMmOut(d.width),
    height: intMmOut(d.height),
    round_corners: boolOut(d.round_corners),
    motif: strOut(d.motif),
  }
}

export const nameTagSchema = loose([
  'quantity', 'material', 'material_other', 'width', 'height', 'round_corners', 'motif',
]).transform((d, ctx) => {
  validateSign(d as Vals, ctx, false)
  return { quantity: qtyOut(d.quantity), ...nameTagToChild(d as Vals) }
})
export type NameTagFields = z.infer<typeof nameTagSchema>
true satisfies NameTagFields extends Omit<TablesInsert<'name_tag_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// GIFT_ITEM
// ---------------------------------------------------------------------------

export function giftItemToChild(d: Vals): Omit<TablesInsert<'gift_item_products'>, 'department_product_id'> {
  return {
    material_free_text: strOut(d.material_free_text),
    origin: strOut(d.origin),
    motif: strOut(d.motif),
  }
}

export const giftItemSchema = loose([
  'quantity', 'material_free_text', 'origin', 'motif',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.material_free_text)) ctx.addIssue({ code: 'custom', path: ['material_free_text'], message: 'Required' })
  const origin = parseRequiredString(d.origin)
  if (!origin || !ORIGINS.includes(origin)) ctx.addIssue({ code: 'custom', path: ['origin'], message: 'Required' })
  if (!parseRequiredString(d.motif)) ctx.addIssue({ code: 'custom', path: ['motif'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...giftItemToChild(d as Vals) }
})
export type GiftItemFields = z.infer<typeof giftItemSchema>
true satisfies GiftItemFields extends Omit<TablesInsert<'gift_item_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// OTHER_LASER
// ---------------------------------------------------------------------------

export function otherLaserToChild(d: Vals): Omit<TablesInsert<'other_laser_products'>, 'department_product_id'> {
  return {
    self_adhesive: boolOut(d.self_adhesive),
    origin: strOut(d.origin),
    motif: strOut(d.motif),
    material_free_text: strOut(d.material_free_text),
  }
}

export const otherLaserSchema = loose([
  'quantity', 'self_adhesive', 'origin', 'motif', 'material_free_text',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (requireBoolPresent(d.self_adhesive) === 'missing') ctx.addIssue({ code: 'custom', path: ['self_adhesive'], message: 'Required' })
  const origin = parseRequiredString(d.origin)
  if (!origin || !ORIGINS.includes(origin)) ctx.addIssue({ code: 'custom', path: ['origin'], message: 'Required' })
  if (!parseRequiredString(d.motif)) ctx.addIssue({ code: 'custom', path: ['motif'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...otherLaserToChild(d as Vals) }
})
export type OtherLaserFields = z.infer<typeof otherLaserSchema>
true satisfies OtherLaserFields extends Omit<TablesInsert<'other_laser_products'>, 'department_product_id'> ? true : never
