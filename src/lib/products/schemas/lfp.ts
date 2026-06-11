/**
 * LFP (large-format print) product schemas — translated field-for-field from
 * `validateLfpDetail` (one schema per `type`). Dimensions use the float parser
 * (comma decimals) with the synthetic `format` OR-key.
 *
 * Each type exports a `<type>ToChild` coercer (the transform's value-mapping
 * lifted out) reused by the form layer.
 */

import { z } from 'zod'
import type { TablesInsert } from '../../../types/supabase'
import {
  loose,
  isValidQuantity,
  parseRequiredString,
  parsePositiveIntMm,
  requireBoolPresent,
  parseIsoDate,
  hasDimensionFloat,
  qtyOut,
  strOut,
  mmOut,
  intMmOut,
  boolOut,
  numOut,
  MSG_FORMAT_MASSE,
} from './_shared'

type Vals = Record<string, unknown>

// ---------------------------------------------------------------------------
// STICKER
// ---------------------------------------------------------------------------

const STICKER_MATERIALS = ['3551', 'ULTRATACK', 'MONSTERTACK', '3162']
const STICKER_CONTOUR = ['FREIFORM', 'RECHTECK']
const STICKER_LAMINATE = ['NEIN', 'MATT', 'GLAENZEND']
const STICKER_OUTPUT = ['EINZEL', 'BOGEN']

export function stickerToChild(d: Vals): Omit<TablesInsert<'sticker_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    material_variant: strOut(d.material_variant),
    contour_cut: strOut(d.contour_cut),
    laminate: strOut(d.laminate),
    output: strOut(d.output),
    width: mmOut(d.width),
    height: mmOut(d.height),
  }
}

export const stickerSchema = loose([
  'quantity', 'material', 'material_variant', 'contour_cut', 'laminate', 'output', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!STICKER_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!STICKER_CONTOUR.includes(parseRequiredString(d.contour_cut) ?? '')) ctx.addIssue({ code: 'custom', path: ['contour_cut'], message: 'Required' })
  if (!STICKER_LAMINATE.includes(parseRequiredString(d.laminate) ?? '')) ctx.addIssue({ code: 'custom', path: ['laminate'], message: 'Required' })
  if (!STICKER_OUTPUT.includes(parseRequiredString(d.output) ?? '')) ctx.addIssue({ code: 'custom', path: ['output'], message: 'Required' })
  if (!hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  return { quantity: qtyOut(d.quantity), ...stickerToChild(d as Vals) }
})
export type StickerFields = z.infer<typeof stickerSchema>
true satisfies StickerFields extends Omit<TablesInsert<'sticker_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// SIGN_UV
// ---------------------------------------------------------------------------

const SIGN_BOARD_MATERIALS = ['ALUVERBUND', 'PVC', 'ACRYLGLAS']
const PRINT_SIDE = ['EINSEITIG', 'BEIDSEITIG']
const ACRYLIC_DIR = ['VORDERSEITE', 'RUECKSEITE']

export function signUvToChild(d: Vals): Omit<TablesInsert<'sign_uv_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    print_side: strOut(d.print_side),
    acrylic_print_direction: strOut(d.acrylic_print_direction),
    round_corners: boolOut(d.round_corners),
    drill_holes: boolOut(d.drill_holes),
    drill_hole_diameter: intMmOut(d.drill_hole_diameter),
    drill_hole_position: strOut(d.drill_hole_position),
    width: mmOut(d.width),
    height: mmOut(d.height),
  }
}

export const signUvSchema = loose([
  'quantity', 'material', 'print_side', 'acrylic_print_direction', 'round_corners', 'drill_holes', 'drill_hole_diameter', 'drill_hole_position', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!SIGN_BOARD_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!PRINT_SIDE.includes(parseRequiredString(d.print_side) ?? '')) ctx.addIssue({ code: 'custom', path: ['print_side'], message: 'Required' })
  if (d.material === 'ACRYLGLAS') {
    if (!ACRYLIC_DIR.includes(parseRequiredString(d.acrylic_print_direction) ?? '')) ctx.addIssue({ code: 'custom', path: ['acrylic_print_direction'], message: 'Required' })
  }
  if (requireBoolPresent(d.round_corners) === 'missing') ctx.addIssue({ code: 'custom', path: ['round_corners'], message: 'Required' })
  if (requireBoolPresent(d.drill_holes) === 'missing') ctx.addIssue({ code: 'custom', path: ['drill_holes'], message: 'Required' })
  if (d.drill_holes === true) {
    if (parsePositiveIntMm(d.drill_hole_diameter) == null) ctx.addIssue({ code: 'custom', path: ['drill_hole_diameter'], message: 'Integer (mm) ≥ 1' })
    if (!parseRequiredString(d.drill_hole_position)) ctx.addIssue({ code: 'custom', path: ['drill_hole_position'], message: 'Required' })
  }
  if (!hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  return { quantity: qtyOut(d.quantity), ...signUvToChild(d as Vals) }
})
export type SignUvFields = z.infer<typeof signUvSchema>
true satisfies SignUvFields extends Omit<TablesInsert<'sign_uv_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// SIGN_FOIL
// ---------------------------------------------------------------------------

const SIGN_FOIL_LAMINATE = ['NEIN', 'MATT', 'GLAENZEND']

export function signFoilToChild(d: Vals): Omit<TablesInsert<'sign_foil_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    print_side: strOut(d.print_side),
    laminate: strOut(d.laminate),
    round_corners: boolOut(d.round_corners),
    drill_holes: boolOut(d.drill_holes),
    drill_hole_diameter: intMmOut(d.drill_hole_diameter),
    drill_hole_position: strOut(d.drill_hole_position),
    width: mmOut(d.width),
    height: mmOut(d.height),
  }
}

export const signFoilSchema = loose([
  'quantity', 'material', 'print_side', 'laminate', 'round_corners', 'drill_holes', 'drill_hole_diameter', 'drill_hole_position', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!SIGN_BOARD_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!PRINT_SIDE.includes(parseRequiredString(d.print_side) ?? '')) ctx.addIssue({ code: 'custom', path: ['print_side'], message: 'Required' })
  if (!SIGN_FOIL_LAMINATE.includes(parseRequiredString(d.laminate) ?? '')) ctx.addIssue({ code: 'custom', path: ['laminate'], message: 'Required' })
  if (requireBoolPresent(d.round_corners) === 'missing') ctx.addIssue({ code: 'custom', path: ['round_corners'], message: 'Required' })
  if (requireBoolPresent(d.drill_holes) === 'missing') ctx.addIssue({ code: 'custom', path: ['drill_holes'], message: 'Required' })
  if (d.drill_holes === true) {
    if (parsePositiveIntMm(d.drill_hole_diameter) == null) ctx.addIssue({ code: 'custom', path: ['drill_hole_diameter'], message: 'Integer (mm) ≥ 1' })
    if (!parseRequiredString(d.drill_hole_position)) ctx.addIssue({ code: 'custom', path: ['drill_hole_position'], message: 'Required' })
  }
  if (!hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  return { quantity: qtyOut(d.quantity), ...signFoilToChild(d as Vals) }
})
export type SignFoilFields = z.infer<typeof signFoilSchema>
true satisfies SignFoilFields extends Omit<TablesInsert<'sign_foil_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// FOIL_PLOTTER
// ---------------------------------------------------------------------------

const FOIL_PLOTTER_MATERIALS = ['751C', '631', '8510']
const FOIL_PLOTTER_OUTPUT = ['EINZEL', 'BOGEN']

export function foilPlotterToChild(d: Vals): Omit<TablesInsert<'foil_plotter_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    output: strOut(d.output),
    width: mmOut(d.width),
    height: mmOut(d.height),
  }
}

export const foilPlotterSchema = loose([
  'quantity', 'material', 'output', 'width', 'height',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!FOIL_PLOTTER_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!FOIL_PLOTTER_OUTPUT.includes(parseRequiredString(d.output) ?? '')) ctx.addIssue({ code: 'custom', path: ['output'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...foilPlotterToChild(d as Vals) }
})
export type FoilPlotterFields = z.infer<typeof foilPlotterSchema>
true satisfies FoilPlotterFields extends Omit<TablesInsert<'foil_plotter_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// BANNER
// ---------------------------------------------------------------------------

const BANNER_MATERIALS = ['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER']

export function bannerToChild(d: Vals): Omit<TablesInsert<'banner_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    width: mmOut(d.width),
    height: mmOut(d.height),
    hem: boolOut(d.hem),
    hem_sides: strOut(d.hem_sides),
    eyelets: boolOut(d.eyelets),
    eyelet_detail: strOut(d.eyelet_detail),
  }
}

export const bannerSchema = loose([
  'quantity', 'material', 'width', 'height', 'hem', 'hem_sides', 'eyelets', 'eyelet_detail',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!BANNER_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!hasDimensionFloat(d.width, d.height)) ctx.addIssue({ code: 'custom', path: ['format'], message: MSG_FORMAT_MASSE })
  if (requireBoolPresent(d.hem) === 'missing') ctx.addIssue({ code: 'custom', path: ['hem'], message: 'Required' })
  if (requireBoolPresent(d.eyelets) === 'missing') ctx.addIssue({ code: 'custom', path: ['eyelets'], message: 'Required' })
  if (d.eyelets === true) {
    if (!parseRequiredString(d.eyelet_detail)) ctx.addIssue({ code: 'custom', path: ['eyelet_detail'], message: 'Required' })
  }
  return { quantity: qtyOut(d.quantity), ...bannerToChild(d as Vals) }
})
export type BannerFields = z.infer<typeof bannerSchema>
true satisfies BannerFields extends Omit<TablesInsert<'banner_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// ROLLUP
// ---------------------------------------------------------------------------

const ROLLUP_MATERIALS = ['PVC_FRONTLIT', 'ROLLUP_FILM']
const ROLLUP_SYSTEMS = ['NEUE_KASSETTE', 'MOTIVTAUSCH']

export function rollupToChild(d: Vals): Omit<TablesInsert<'rollup_products'>, 'department_product_id'> {
  return {
    material: strOut(d.material),
    rollup_system: strOut(d.rollup_system),
    rollup_width: numOut(d.rollup_width),
  }
}

export const rollupSchema = loose([
  'quantity', 'material', 'rollup_system', 'rollup_width',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!ROLLUP_MATERIALS.includes(parseRequiredString(d.material) ?? '')) ctx.addIssue({ code: 'custom', path: ['material'], message: 'Required' })
  if (!ROLLUP_SYSTEMS.includes(parseRequiredString(d.rollup_system) ?? '')) ctx.addIssue({ code: 'custom', path: ['rollup_system'], message: 'Required' })
  const width = Number(d.rollup_width)
  if (width !== 85 && width !== 100) ctx.addIssue({ code: 'custom', path: ['rollup_width'], message: 'Select width 85 or 100 cm' })
  return { quantity: qtyOut(d.quantity), ...rollupToChild(d as Vals) }
})
export type RollupFields = z.infer<typeof rollupSchema>
true satisfies RollupFields extends Omit<TablesInsert<'rollup_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// VEHICLE_LETTERING
// ---------------------------------------------------------------------------

const INSTALLATION = ['MIT', 'OHNE']

export function vehicleLetteringToChild(d: Vals): Omit<TablesInsert<'vehicle_lettering_products'>, 'department_product_id'> {
  return {
    vehicle_make: strOut(d.vehicle_make),
    vehicle_model: strOut(d.vehicle_model),
    area_sides: boolOut(d.area_sides),
    area_front: boolOut(d.area_front),
    area_rear: boolOut(d.area_rear),
    installation: strOut(d.installation),
    existing_wrap: boolOut(d.existing_wrap),
    installation_date: strOut(d.installation_date),
  }
}

export const vehicleLetteringSchema = loose([
  'quantity', 'vehicle_make', 'vehicle_model', 'area_sides', 'area_front', 'area_rear', 'installation', 'existing_wrap', 'installation_date',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.vehicle_make)) ctx.addIssue({ code: 'custom', path: ['vehicle_make'], message: 'Required' })
  if (!parseRequiredString(d.vehicle_model)) ctx.addIssue({ code: 'custom', path: ['vehicle_model'], message: 'Required' })
  if (requireBoolPresent(d.area_sides) === 'missing') ctx.addIssue({ code: 'custom', path: ['area_sides'], message: 'Required' })
  if (requireBoolPresent(d.area_front) === 'missing') ctx.addIssue({ code: 'custom', path: ['area_front'], message: 'Required' })
  if (requireBoolPresent(d.area_rear) === 'missing') ctx.addIssue({ code: 'custom', path: ['area_rear'], message: 'Required' })
  if (!INSTALLATION.includes(parseRequiredString(d.installation) ?? '')) ctx.addIssue({ code: 'custom', path: ['installation'], message: 'Required' })
  if (d.installation === 'MIT' && requireBoolPresent(d.existing_wrap) === 'missing') ctx.addIssue({ code: 'custom', path: ['existing_wrap'], message: 'Required' })
  if (d.installation === 'MIT' && !parseIsoDate(d.installation_date)) ctx.addIssue({ code: 'custom', path: ['installation_date'], message: 'Valid date' })
  return { quantity: qtyOut(d.quantity), ...vehicleLetteringToChild(d as Vals) }
})
export type VehicleLetteringFields = z.infer<typeof vehicleLetteringSchema>
true satisfies VehicleLetteringFields extends Omit<TablesInsert<'vehicle_lettering_products'>, 'department_product_id'> ? true : never

// ---------------------------------------------------------------------------
// OTHER_LFP
// ---------------------------------------------------------------------------

export function otherLfpToChild(d: Vals): Omit<TablesInsert<'other_lfp_products'>, 'department_product_id'> {
  return { description: strOut(d.description) }
}

export const otherLfpSchema = loose([
  'quantity', 'description',
]).transform((d, ctx) => {
  if (!isValidQuantity(d.quantity)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Integer ≥ 1' })
  if (!parseRequiredString(d.description)) ctx.addIssue({ code: 'custom', path: ['description'], message: 'Required' })
  return { quantity: qtyOut(d.quantity), ...otherLfpToChild(d as Vals) }
})
export type OtherLfpFields = z.infer<typeof otherLfpSchema>
true satisfies OtherLfpFields extends Omit<TablesInsert<'other_lfp_products'>, 'department_product_id'> ? true : never
