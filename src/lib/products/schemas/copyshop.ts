/**
 * CopyShop product schemas — translated field-for-field from the old
 * `validateCopyShopDetail` (one schema per `type`, plus the production-path
 * sub-validators it shared across types). The stored enum VALUE strings stay
 * German (A4, DIN_LANG, FREI, CC, OFFSET, MITTELFALZ, …).
 *
 * Each schema is a lenient base object + a single `transform(d, ctx)` that
 * validates (via `ctx.addIssue({ path:[key] })`) and coerces to the child shape.
 * See `_shared.ts` for the pattern and the raw parsers.
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import {
  loose,
  isValidQuantity,
  parseRequiredString,
  parseMmDimension,
  parseIntWithMin,
  requireBoolPresent,
  hasDimensionFloat,
  qtyOut,
  strOut,
  mmOut,
  boolOut,
  numOut,
  MSG_FORMAT_MASSE,
} from './_shared'

// ---------------------------------------------------------------------------
// Shared sub-validators (copied verbatim from validateCopyShopDetail).
// ---------------------------------------------------------------------------

type Fields = Record<string, unknown>
const add = (ctx: z.RefinementCtx, field: string, message: string) =>
  ctx.addIssue({ code: 'custom', path: [field], message })

const CC_G = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE']

function validateCcMaterialPair(f: Fields, ctx: z.RefinementCtx, materialKey: string, otherKey: string) {
  const material = parseRequiredString(f[materialKey])
  if (!material || !CC_G.includes(material)) add(ctx, materialKey, 'Required')
  if (material === 'SONSTIGE' && !parseRequiredString(f[otherKey])) add(ctx, otherKey, 'Required')
}

function validateCardFoldFormat(isFolded: boolean, f: Fields, ctx: z.RefinementCtx) {
  const format = parseRequiredString(f.format)
  const validCardFormats = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'A3', 'FREI']
  const validFoldFormats = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'FREI']
  if (isFolded) {
    if (!validFoldFormats.includes(format ?? '')) add(ctx, 'format', 'Required')
  } else {
    if (!validCardFormats.includes(format ?? '')) add(ctx, 'format', 'Required')
  }
  if (format === 'FREI' && !hasDimensionFloat(f.width, f.height)) add(ctx, 'format_masse', MSG_FORMAT_MASSE)
  else if (format && format !== 'FREI' && !hasDimensionFloat(f.width, f.height)) add(ctx, 'format_masse', MSG_FORMAT_MASSE)
}

function validateOffsetMaterial(f: Fields, ctx: z.RefinementCtx) {
  const offsetType = parseRequiredString(f.offset_type)
  if (!['STANDARD', 'OFFSET', 'SPEZIAL'].includes(offsetType ?? '')) add(ctx, 'offset_type', 'Required')
  if (offsetType === 'STANDARD') {
    if (!['115G', '135G', '170G', '250G', '300G', '350G', '400G'].includes(parseRequiredString(f.offset_weight) ?? '')) {
      add(ctx, 'offset_weight', 'Required')
    }
    if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(f.offset_finish) ?? '')) {
      add(ctx, 'offset_finish', 'Required')
    }
  } else if (offsetType === 'OFFSET') {
    if (!['80G', '90G', '100G', '120G', '150G', '250G'].includes(parseRequiredString(f.offset_weight) ?? '')) {
      add(ctx, 'offset_weight', 'Required')
    }
  } else if (offsetType === 'SPEZIAL') {
    const specialPaper = parseRequiredString(f.special_paper)
    if (!['300G_FOLIENKASCHIERT', 'RECYCLING', '250G_LEINENSTRUKTUR', 'SONSTIGE'].includes(specialPaper ?? '')) {
      add(ctx, 'special_paper', 'Required')
    } else if (specialPaper === '300G_FOLIENKASCHIERT') {
      if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(f.lamination_finish) ?? '')) add(ctx, 'lamination_finish', 'Required')
      if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(f.lamination_sides) ?? '')) {
        add(ctx, 'lamination_sides', 'Required')
      }
    } else if (specialPaper === 'RECYCLING') {
      if (!['80G', '135G', '150G', '300G'].includes(parseRequiredString(f.recycling_weight) ?? '')) {
        add(ctx, 'recycling_weight', 'Required')
      }
    } else if (specialPaper === 'SONSTIGE') {
      if (!parseRequiredString(f.special_paper_other)) add(ctx, 'special_paper_other', 'Required')
    }
  }
}

function validateBrochureOffsetOrOpen(f: Fields, ctx: z.RefinementCtx) {
  if (!['DRAHTHEFTUNG', 'RINGSÖSEN', 'KLEBEBINDUNG', 'SPIRALBINDUNG'].includes(parseRequiredString(f.binding) ?? '')) {
    add(ctx, 'binding', 'Required')
  }
  if (!['135G', '170G', '250G', '300G'].includes(parseRequiredString(f.cover_weight) ?? '')) add(ctx, 'cover_weight', 'Required')
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(f.cover_finish) ?? '')) add(ctx, 'cover_finish', 'Required')
  if (!['90G', '135G', '170G'].includes(parseRequiredString(f.inner_weight) ?? '')) add(ctx, 'inner_weight', 'Required')
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(f.inner_finish) ?? '')) add(ctx, 'inner_finish', 'Required')
}

function validateFoldPageCount(f: Fields, ctx: z.RefinementCtx) {
  const pageCount = parseIntWithMin(f.page_count, 2)
  if (pageCount == null) add(ctx, 'page_count', 'Required')
  else if (pageCount > 100) add(ctx, 'page_count', 'Max. 100')
  else if (pageCount % 2 !== 0) add(ctx, 'page_count', 'Even numbers only (2–100)')
}

function validateBrochurePageCount(f: Fields, ctx: z.RefinementCtx) {
  const pageCount = parseIntWithMin(f.page_count, 4)
  if (pageCount == null) add(ctx, 'page_count', 'Required')
  else if (pageCount > 152) add(ctx, 'page_count', 'Max. 152')
  else if (pageCount % 4 !== 0) add(ctx, 'page_count', 'Page count must be divisible by 4')
}

function validateBrochureFormat(f: Fields, ctx: z.RefinementCtx) {
  const format = parseRequiredString(f.format)
  if (!['A6', 'A5', 'A4', 'FREI'].includes(format ?? '')) add(ctx, 'format', 'Required')
  if (format === 'FREI' && !hasDimensionFloat(f.width, f.height)) add(ctx, 'format_masse', MSG_FORMAT_MASSE)
  else if (format && format !== 'FREI' && !hasDimensionFloat(f.width, f.height)) add(ctx, 'format_masse', MSG_FORMAT_MASSE)
}

function isBindingColorValid(bindingType: string | null, color: string | null): boolean {
  if (!bindingType || !color) return false
  const sets: Record<string, string[]> = {
    WIRE_O: ['SCHWARZ', 'SILBER'],
    KUNSTSTOFFSPIRALE: ['SCHWARZ', 'WEISS'],
    SOFTCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
    HARDCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
  }
  return sets[bindingType]?.includes(color) ?? false
}

// ---------------------------------------------------------------------------
// POSTER
// ---------------------------------------------------------------------------

const POSTER_FORMATS = ['A4', 'A3', 'A2', 'A1', 'A0', 'FREI']
const POSTER_MATERIALS = ['120G_AFFICHEN', '200G_SEIDENGLANZ', '200G_GLANZ']
const POSTER_LAMINATES = ['NEIN', 'MATT', 'GLAENZEND']

export const posterSchema = loose([
  'quantity', 'format', 'material', 'laminate', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  const format = parseRequiredString(d.format)
  if (!POSTER_FORMATS.includes(format ?? '')) ctx.addIssue({ code: 'custom', path: ['format'], message: 'Required' })
  if (!POSTER_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!POSTER_LAMINATES.includes(parseRequiredString(d.laminate) ?? '')) ctx.addIssue({ code: 'custom', path: ['laminate'], message: 'Required' })
  if (format === 'FREI' && !hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format_masse'], message: MSG_FORMAT_MASSE })
  else if (format && format !== 'FREI' && !hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format_masse'], message: MSG_FORMAT_MASSE })
  return {
    quantity: qtyOut(d.quantity),
    format: strOut(d.format),
    material: strOut(d.material),
    laminate: strOut(d.laminate),
    width: mmOut(d.width),
    height: mmOut(d.height),
  }
})
export type PosterFields = z.infer<typeof posterSchema>
true satisfies PosterFields extends Omit<TablesInsert<'poster_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// CARD_FLYER
// ---------------------------------------------------------------------------

const CARD_FLYER_COLOR_MODE = ['1_0', '1_1', '4_0', '4_4']

export const cardFlyerSchema = loose([
  'quantity', 'production_path', 'color_mode', 'format', 'width', 'height', 'full_bleed',
  'cc_material', 'cc_material_other',
  'offset_type', 'offset_weight', 'offset_finish', 'special_paper', 'special_paper_other',
  'recycling_weight', 'lamination_finish', 'lamination_sides',
]).transform((d, ctx) => {
  const f = d as Fields
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!['CC', 'OFFSET', 'OFFEN'].includes(parseRequiredString(d.production_path) ?? '')) ctx.addIssue({ code: 'custom', path: ['production_path'], message: 'Required' })
  if (!CARD_FLYER_COLOR_MODE.includes(parseRequiredString(d.color_mode) ?? '')) ctx.addIssue({ code: 'custom', path: ['color_mode'], message: 'Required' })
  validateCardFoldFormat(false, f, ctx)
  if (requireBoolPresent(d.full_bleed) === 'missing') ctx.addIssue({ code: 'custom', path: ['full_bleed'], message: 'Required' })
  const pp = parseRequiredString(d.production_path)
  if (pp === 'CC') validateCcMaterialPair(f, ctx, 'cc_material', 'cc_material_other')
  else if (pp === 'OFFSET') validateOffsetMaterial(f, ctx)
  return {
    quantity: qtyOut(d.quantity),
    production_path: strOut(d.production_path),
    color_mode: strOut(d.color_mode),
    format: strOut(d.format),
    width: mmOut(d.width),
    height: mmOut(d.height),
    full_bleed: boolOut(d.full_bleed),
    cc_material: strOut(d.cc_material),
    cc_material_other: strOut(d.cc_material_other),
    offset_type: strOut(d.offset_type),
    offset_weight: strOut(d.offset_weight),
    offset_finish: strOut(d.offset_finish),
    special_paper: strOut(d.special_paper),
    special_paper_other: strOut(d.special_paper_other),
    recycling_weight: strOut(d.recycling_weight),
    lamination_finish: strOut(d.lamination_finish),
    lamination_sides: strOut(d.lamination_sides),
  }
})
export type CardFlyerFields = z.infer<typeof cardFlyerSchema>
true satisfies CardFlyerFields extends Omit<TablesInsert<'card_flyer_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// FOLDED_FLYER
// ---------------------------------------------------------------------------

const FOLDED_FLYER_COLOR_MODE = ['1_1', '4_4']
const FOLD_TYPE = ['MITTELFALZ', 'WICKELFALZ', 'ZICKZACK']

export const foldedFlyerSchema = loose([
  'quantity', 'production_path', 'color_mode', 'fold_type', 'format', 'width', 'height', 'page_count', 'full_bleed',
  'cc_material', 'cc_material_other',
  'offset_type', 'offset_weight', 'offset_finish', 'special_paper', 'special_paper_other',
  'recycling_weight', 'lamination_finish', 'lamination_sides',
]).transform((d, ctx) => {
  const f = d as Fields
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!['CC', 'OFFSET', 'OFFEN'].includes(parseRequiredString(d.production_path) ?? '')) ctx.addIssue({ code: 'custom', path: ['production_path'], message: 'Required' })
  if (!FOLDED_FLYER_COLOR_MODE.includes(parseRequiredString(d.color_mode) ?? '')) ctx.addIssue({ code: 'custom', path: ['color_mode'], message: 'Required' })
  if (!FOLD_TYPE.includes(parseRequiredString(d.fold_type) ?? '')) ctx.addIssue({ code: 'custom', path: ['fold_type'], message: 'Required' })
  validateCardFoldFormat(true, f, ctx)
  validateFoldPageCount(f, ctx)
  if (requireBoolPresent(d.full_bleed) === 'missing') ctx.addIssue({ code: 'custom', path: ['full_bleed'], message: 'Required' })
  const pp = parseRequiredString(d.production_path)
  if (pp === 'CC') validateCcMaterialPair(f, ctx, 'cc_material', 'cc_material_other')
  else if (pp === 'OFFSET') validateOffsetMaterial(f, ctx)
  return {
    quantity: qtyOut(d.quantity),
    production_path: strOut(d.production_path),
    color_mode: strOut(d.color_mode),
    fold_type: strOut(d.fold_type),
    format: strOut(d.format),
    width: mmOut(d.width),
    height: mmOut(d.height),
    page_count: numOut(d.page_count),
    full_bleed: boolOut(d.full_bleed),
    cc_material: strOut(d.cc_material),
    cc_material_other: strOut(d.cc_material_other),
    offset_type: strOut(d.offset_type),
    offset_weight: strOut(d.offset_weight),
    offset_finish: strOut(d.offset_finish),
    special_paper: strOut(d.special_paper),
    special_paper_other: strOut(d.special_paper_other),
    recycling_weight: strOut(d.recycling_weight),
    lamination_finish: strOut(d.lamination_finish),
    lamination_sides: strOut(d.lamination_sides),
  }
})
export type FoldedFlyerFields = z.infer<typeof foldedFlyerSchema>
true satisfies FoldedFlyerFields extends Omit<TablesInsert<'folded_flyer_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// BROCHURE
// ---------------------------------------------------------------------------

const BROCHURE_ORIENTATION = ['HOCHFORMAT', 'QUERFORMAT']

export const brochureSchema = loose([
  'quantity', 'production_path', 'format', 'width', 'height', 'orientation', 'page_count', 'full_bleed',
  'cover_material', 'cover_material_other', 'inner_material', 'inner_material_other',
  'binding', 'cover_weight', 'cover_finish', 'inner_weight', 'inner_finish',
]).transform((d, ctx) => {
  const f = d as Fields
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!['CC', 'OFFSET', 'OFFEN'].includes(parseRequiredString(d.production_path) ?? '')) ctx.addIssue({ code: 'custom', path: ['production_path'], message: 'Required' })
  validateBrochureFormat(f, ctx)
  if (!BROCHURE_ORIENTATION.includes(parseRequiredString(d.orientation) ?? '')) ctx.addIssue({ code: 'custom', path: ['orientation'], message: 'Required' })
  validateBrochurePageCount(f, ctx)
  const pp = parseRequiredString(d.production_path)
  const orientation = parseRequiredString(d.orientation)
  if (orientation === 'QUERFORMAT' && pp === 'CC') ctx.addIssue({ code: 'custom', path: ['brochure_landscape_cc'], message: 'Landscape only for Offset or Open' })
  if (pp === 'CC') {
    validateCcMaterialPair(f, ctx, 'cover_material', 'cover_material_other')
    validateCcMaterialPair(f, ctx, 'inner_material', 'inner_material_other')
  } else if (pp === 'OFFSET' || pp === 'OFFEN') {
    validateBrochureOffsetOrOpen(f, ctx)
  }
  if (requireBoolPresent(d.full_bleed) === 'missing') ctx.addIssue({ code: 'custom', path: ['full_bleed'], message: 'Required' })
  return {
    quantity: qtyOut(d.quantity),
    production_path: strOut(d.production_path),
    format: strOut(d.format),
    width: mmOut(d.width),
    height: mmOut(d.height),
    orientation: strOut(d.orientation),
    page_count: numOut(d.page_count),
    full_bleed: boolOut(d.full_bleed),
    cover_material: strOut(d.cover_material),
    cover_material_other: strOut(d.cover_material_other),
    inner_material: strOut(d.inner_material),
    inner_material_other: strOut(d.inner_material_other),
    binding: strOut(d.binding),
    cover_weight: strOut(d.cover_weight),
    cover_finish: strOut(d.cover_finish),
    inner_weight: strOut(d.inner_weight),
    inner_finish: strOut(d.inner_finish),
  }
})
export type BrochureFields = z.infer<typeof brochureSchema>
true satisfies BrochureFields extends Omit<TablesInsert<'brochure_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// BUSINESS_CARD
// ---------------------------------------------------------------------------

const BUSINESS_CARD_MATERIALS = ['300G_CC', '350G_OFFSET', '400G_OFFSET', '300G_RECYCLING', '250G_LEINENSTRUKTUR', 'MULTILOFT']
const BUSINESS_CARD_COLOR_MODE = ['4_0', '4_4']
const BUSINESS_CARD_FORMATS = ['STANDARD_85_55', 'STANDARD_90_50', 'FREI']
const BUSINESS_CARD_ORIENTATION = ['HOCHFORMAT', 'QUERFORMAT']
const MULTILOFT_COLORS = ['SCHWARZ', 'ELFENBEIN', 'WEISS', 'ROT', 'OLIVGRUEN', 'HELLGRUEN', 'TUERKIS', 'LILA', 'GELB', 'ORANGE', 'MAGENTA', 'ROSA', 'BLAU']

export const businessCardSchema = loose([
  'quantity', 'material', 'color_mode', 'format', 'width', 'height', 'orientation', 'film_laminated', 'multiloft_color', 'full_bleed',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  const material = parseRequiredString(d.material)
  if (!material || !BUSINESS_CARD_MATERIALS.includes(material)) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!BUSINESS_CARD_COLOR_MODE.includes(parseRequiredString(d.color_mode) ?? '')) ctx.addIssue({ code: 'custom', path: ['color_mode'], message: 'Required' })
  const format = parseRequiredString(d.format)
  if (!BUSINESS_CARD_FORMATS.includes(format ?? '')) ctx.addIssue({ code: 'custom', path: ['format'], message: 'Required' })
  if (format === 'FREI' && !hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format_masse'], message: MSG_FORMAT_MASSE })
  if (!BUSINESS_CARD_ORIENTATION.includes(parseRequiredString(d.orientation) ?? '')) ctx.addIssue({ code: 'custom', path: ['orientation'], message: 'Required' })
  if (material === '350G_OFFSET' && requireBoolPresent(d.film_laminated) === 'missing') ctx.addIssue({ code: 'custom', path: ['film_laminated'], message: 'Required' })
  if (material === 'MULTILOFT') {
    if (!MULTILOFT_COLORS.includes(parseRequiredString(d.multiloft_color) ?? '')) ctx.addIssue({ code: 'custom', path: ['multiloft_color'], message: 'Required' })
  }
  if (requireBoolPresent(d.full_bleed) === 'missing') ctx.addIssue({ code: 'custom', path: ['full_bleed'], message: 'Required' })
  return {
    quantity: qtyOut(d.quantity),
    material: strOut(d.material),
    color_mode: strOut(d.color_mode),
    format: strOut(d.format),
    width: mmOut(d.width),
    height: mmOut(d.height),
    orientation: strOut(d.orientation),
    film_laminated: boolOut(d.film_laminated),
    multiloft_color: strOut(d.multiloft_color),
    full_bleed: boolOut(d.full_bleed),
  }
})
export type BusinessCardFields = z.infer<typeof businessCardSchema>
true satisfies BusinessCardFields extends Omit<TablesInsert<'business_card_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// BINDING
// ---------------------------------------------------------------------------

const BINDING_MATERIALS = ['80G', '100G', '120G', 'SONSTIGE']
const BINDING_COLOR_MODE = ['1_0', '1_1', '4_0', '4_1']
const BINDING_TYPES = ['WIRE_O', 'KUNSTSTOFFSPIRALE', 'SOFTCOVER', 'HARDCOVER']

export const bindingSchema = loose([
  'quantity', 'material', 'material_other', 'color_mode', 'binding_type', 'binding_color',
  'format', 'orientation', 'width', 'height', 'hardcover_print', 'hardcover_cover', 'full_bleed',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  const material = parseRequiredString(d.material)
  if (!BINDING_MATERIALS.includes(material ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (material === 'SONSTIGE' && !parseRequiredString(d.material_other)) ctx.addIssue({ code: 'custom', path: ['material_other'], message: 'Required' })
  if (!BINDING_COLOR_MODE.includes(parseRequiredString(d.color_mode) ?? '')) ctx.addIssue({ code: 'custom', path: ['color_mode'], message: 'Required' })
  const bindingType = parseRequiredString(d.binding_type)
  if (!BINDING_TYPES.includes(bindingType ?? '')) ctx.addIssue({ code: 'custom', path: ['binding_type'], message: 'Required' })
  const bindingColor = parseRequiredString(d.binding_color)
  if (!bindingType || !bindingColor || !isBindingColorValid(bindingType, bindingColor)) ctx.addIssue({ code: 'custom', path: ['binding_color'], message: 'Required' })
  if (bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE') {
    const wireFormat = parseRequiredString(d.format)
    if (!['A5', 'A4', 'A3', 'FREI'].includes(wireFormat ?? '')) ctx.addIssue({ code: 'custom', path: ['format'], message: 'Required' })
    const orientation = parseRequiredString(d.orientation)
    if (wireFormat === 'A5' || wireFormat === 'A4') {
      if (!['HOCHFORMAT', 'QUERFORMAT'].includes(orientation ?? '')) ctx.addIssue({ code: 'custom', path: ['orientation'], message: 'Required' })
    }
    if (wireFormat === 'A3' && orientation !== 'QUERFORMAT') ctx.addIssue({ code: 'custom', path: ['orientation'], message: 'A3 nur Querformat' })
    if (wireFormat === 'FREI') {
      const height = parseMmDimension(d.height)
      if (height != null && height > 300) ctx.addIssue({ code: 'custom', path: ['height'], message: 'Height max. 300 mm (binding edge)' })
    }
  } else if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
    if (parseRequiredString(d.format) !== 'A4') ctx.addIssue({ code: 'custom', path: ['format'], message: 'A4 Hochformat 210×297 mm' })
    else if (parseRequiredString(d.orientation) !== 'HOCHFORMAT') ctx.addIssue({ code: 'custom', path: ['orientation'], message: 'Required' })
    else {
      const width = parseMmDimension(d.width)
      const height = parseMmDimension(d.height)
      if (width == null || height == null || Math.abs(width - 210) > 0.5 || Math.abs(height - 297) > 0.5) {
        ctx.addIssue({ code: 'custom', path: ['format'], message: 'A4 Hochformat 210×297 mm' })
      }
    }
  }
  if (bindingType === 'HARDCOVER') {
    if (requireBoolPresent(d.hardcover_print) === 'missing') ctx.addIssue({ code: 'custom', path: ['hardcover_print'], message: 'Required' })
    if (d.hardcover_print === true && !parseRequiredString(d.hardcover_cover)) ctx.addIssue({ code: 'custom', path: ['hardcover_cover'], message: 'Required' })
  }
  if (requireBoolPresent(d.full_bleed) === 'missing') ctx.addIssue({ code: 'custom', path: ['full_bleed'], message: 'Required' })
  return {
    quantity: qtyOut(d.quantity),
    material: strOut(d.material),
    material_other: strOut(d.material_other),
    color_mode: strOut(d.color_mode),
    binding_type: strOut(d.binding_type),
    binding_color: strOut(d.binding_color),
    format: strOut(d.format),
    orientation: strOut(d.orientation),
    width: mmOut(d.width),
    height: mmOut(d.height),
    hardcover_print: boolOut(d.hardcover_print),
    hardcover_cover: strOut(d.hardcover_cover),
    full_bleed: boolOut(d.full_bleed),
  }
})
export type BindingFields = z.infer<typeof bindingSchema>
true satisfies BindingFields extends Omit<TablesInsert<'binding_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// PRINTOUT
// ---------------------------------------------------------------------------

const PRINTOUT_FORMATS = ['A5', 'A4', 'A3']
const PRINTOUT_MATERIALS = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE']
const PRINTOUT_COLOR_MODE = ['1_0', '1_1', '4_0', '4_1']
const PRINTOUT_PUNCHING = ['NEIN', '2_LOCH', '4_LOCH']
const PRINTOUT_LAMINATE = ['NEIN', 'MATT', 'GLAENZEND']

export const printoutSchema = loose([
  'quantity', 'format', 'material', 'material_other', 'color_mode', 'punching', 'staple', 'laminate',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!PRINTOUT_FORMATS.includes(parseRequiredString(d.format) ?? '')) ctx.addIssue({ code: 'custom', path: ['format'], message: 'Required' })
  const material = parseRequiredString(d.material)
  if (!PRINTOUT_MATERIALS.includes(material ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (material === 'SONSTIGE' && !parseRequiredString(d.material_other)) ctx.addIssue({ code: 'custom', path: ['material_other'], message: 'Required' })
  if (!PRINTOUT_COLOR_MODE.includes(parseRequiredString(d.color_mode) ?? '')) ctx.addIssue({ code: 'custom', path: ['color_mode'], message: 'Required' })
  if (!PRINTOUT_PUNCHING.includes(parseRequiredString(d.punching) ?? '')) ctx.addIssue({ code: 'custom', path: ['punching'], message: 'Required' })
  if (requireBoolPresent(d.staple) === 'missing') ctx.addIssue({ code: 'custom', path: ['staple'], message: 'Required' })
  if (!PRINTOUT_LAMINATE.includes(parseRequiredString(d.laminate) ?? '')) ctx.addIssue({ code: 'custom', path: ['laminate'], message: 'Required' })
  return {
    quantity: qtyOut(d.quantity),
    format: strOut(d.format),
    material: strOut(d.material),
    material_other: strOut(d.material_other),
    color_mode: strOut(d.color_mode),
    punching: strOut(d.punching),
    staple: boolOut(d.staple),
    laminate: strOut(d.laminate),
  }
})
export type PrintoutFields = z.infer<typeof printoutSchema>
true satisfies PrintoutFields extends Omit<TablesInsert<'printout_products'>, 'department_product_id'> ? true : never
