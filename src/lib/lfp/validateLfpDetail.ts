/**
 * Validation for LFP (Large Format Print) products.
 *
 * Operates on the English typed fields of an LFP product (the child columns
 * plus the parent `quantity`), keyed by `type`. Field keys are English; the
 * stored enum VALUE strings (FREIFORM, NEIN, MATT, MIT, …) are kept as-is for
 * now (the value→English pass is deferred, shop-confirmed).
 *
 * Per type:
 * - `STICKER`: material, contour_cut, laminate, output, at least one dimension.
 * - `SIGN_UV`: material, print_side, (acrylic_print_direction when ACRYLGLAS),
 *   round_corners, drill_holes (+ diameter/position when set), one dimension.
 * - `SIGN_FOIL`: material, print_side, laminate, round_corners, drill_holes
 *   (+ diameter/position when set), one dimension.
 * - `FOIL_PLOTTER`: material, output.
 * - `BANNER`: material, one dimension, hem, eyelets (+ eyelet_detail when set).
 * - `ROLLUP`: material, rollup_system, rollup_width (85 or 100 cm).
 * - `VEHICLE_LETTERING`: vehicle_make, vehicle_model, area_*, installation
 *   (+ existing_wrap / installation_date when WITH ('MIT')).
 * - `OTHER_LFP`: description.
 *
 * In `QUOTE` stage nothing is required. Returns a map of field-key → message.
 */

import { LFP_TYPES, type LfpType } from '../../types/lfp'
import type { OrderStatus } from '../../types/database'

/** Trim and require non-empty. Returns the trimmed string or `null`. */
function parseRequiredString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Boolean must be explicitly true or false (not absent). */
function requireBoolPresent(value: unknown): 'ok' | 'missing' {
  if (value === true || value === false) return 'ok'
  return 'missing'
}

/** Parse a positive millimeter dimension; accepts comma or dot decimals. */
function parseMmDimension(value: unknown): number | null {
  if (value === '' || value == null) return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/** Validate an ISO date string; returns the YYYY-MM-DD prefix or `null`. */
function parseIsoDate(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return value.slice(0, 10)
}

/** At least one dimension (width or height) > 0 mm. */
function hasDimension(width: unknown, height: unknown): boolean {
  return parseMmDimension(width) != null || parseMmDimension(height) != null
}

/** Quantity must be a positive integer (≥ 1). */
function isValidQuantity(value: unknown): boolean {
  if (value == null || value === '') return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 1
}

/** Positive integer millimeter value, or `null` if invalid/missing. */
function parsePositiveIntMm(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

type Err = Record<string, string>
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
}

const MSG_MASSE = 'Provide at least width or height'

/**
 * Validate an LFP product's type + English child fields against its status.
 *
 * @param type   the product type discriminator
 * @param fields English child columns + the parent `quantity`
 *
 * Returns a map of field-key → message; empty map means valid. In `QUOTE` no
 * fields are required. Otherwise the type must be one of {@link LFP_TYPES},
 * `quantity` must be a positive integer, and the type-specific keys
 * (material, dimensions, options, etc.) must be set. The stored VALUE strings
 * stay German (FREIFORM, NEIN, MATT, MIT, …).
 */
export function validateLfpDetail(
  type: string | null,
  fields: Record<string, unknown>,
  subOrderStatus: OrderStatus,
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!type || !LFP_TYPES.includes(type as LfpType)) {
    addError(errors, 'type', 'Select type')
    return errors
  }
  if (!isValidQuantity(fields.quantity)) addError(errors, 'quantity', 'Integer ≥ 1')

  const lfpType = type as LfpType
  if (lfpType === 'STICKER') {
    if (!['3551', 'ULTRATACK', 'MONSTERTACK', '3162'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['FREIFORM', 'RECHTECK'].includes(parseRequiredString(fields.contour_cut) ?? '')) addError(errors, 'contour_cut', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(fields.laminate) ?? '')) addError(errors, 'laminate', 'Required')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(fields.output) ?? '')) addError(errors, 'output', 'Required')
    if (!hasDimension(fields.width, fields.height)) addError(errors, 'format', MSG_MASSE)
  } else if (lfpType === 'SIGN_UV') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(fields.print_side) ?? '')) addError(errors, 'print_side', 'Required')
    if (fields.material === 'ACRYLGLAS') {
      if (!['VORDERSEITE', 'RUECKSEITE'].includes(parseRequiredString(fields.acrylic_print_direction) ?? '')) addError(errors, 'acrylic_print_direction', 'Required')
    }
    if (requireBoolPresent(fields.round_corners) === 'missing') addError(errors, 'round_corners', 'Required')
    if (requireBoolPresent(fields.drill_holes) === 'missing') addError(errors, 'drill_holes', 'Required')
    if (fields.drill_holes === true) {
      if (parsePositiveIntMm(fields.drill_hole_diameter) == null) addError(errors, 'drill_hole_diameter', 'Integer (mm) ≥ 1')
      if (!parseRequiredString(fields.drill_hole_position)) addError(errors, 'drill_hole_position', 'Required')
    }
    if (!hasDimension(fields.width, fields.height)) addError(errors, 'format', MSG_MASSE)
  } else if (lfpType === 'SIGN_FOIL') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(fields.print_side) ?? '')) addError(errors, 'print_side', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(fields.laminate) ?? '')) addError(errors, 'laminate', 'Required')
    if (requireBoolPresent(fields.round_corners) === 'missing') addError(errors, 'round_corners', 'Required')
    if (requireBoolPresent(fields.drill_holes) === 'missing') addError(errors, 'drill_holes', 'Required')
    if (fields.drill_holes === true) {
      if (parsePositiveIntMm(fields.drill_hole_diameter) == null) addError(errors, 'drill_hole_diameter', 'Integer (mm) ≥ 1')
      if (!parseRequiredString(fields.drill_hole_position)) addError(errors, 'drill_hole_position', 'Required')
    }
    if (!hasDimension(fields.width, fields.height)) addError(errors, 'format', MSG_MASSE)
  } else if (lfpType === 'FOIL_PLOTTER') {
    if (!['751C', '631', '8510'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(fields.output) ?? '')) addError(errors, 'output', 'Required')
  } else if (lfpType === 'BANNER') {
    if (!['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!hasDimension(fields.width, fields.height)) addError(errors, 'format', MSG_MASSE)
    if (requireBoolPresent(fields.hem) === 'missing') addError(errors, 'hem', 'Required')
    if (requireBoolPresent(fields.eyelets) === 'missing') addError(errors, 'eyelets', 'Required')
    if (fields.eyelets === true) {
      if (!parseRequiredString(fields.eyelet_detail)) addError(errors, 'eyelet_detail', 'Required')
    }
  } else if (lfpType === 'ROLLUP') {
    if (!['PVC_FRONTLIT', 'ROLLUP_FILM'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['NEUE_KASSETTE', 'MOTIVTAUSCH'].includes(parseRequiredString(fields.rollup_system) ?? '')) addError(errors, 'rollup_system', 'Required')
    const width = Number(fields.rollup_width)
    if (width !== 85 && width !== 100) addError(errors, 'rollup_width', 'Select width 85 or 100 cm')
  } else if (lfpType === 'VEHICLE_LETTERING') {
    if (!parseRequiredString(fields.vehicle_make)) addError(errors, 'vehicle_make', 'Required')
    if (!parseRequiredString(fields.vehicle_model)) addError(errors, 'vehicle_model', 'Required')
    if (requireBoolPresent(fields.area_sides) === 'missing') addError(errors, 'area_sides', 'Required')
    if (requireBoolPresent(fields.area_front) === 'missing') addError(errors, 'area_front', 'Required')
    if (requireBoolPresent(fields.area_rear) === 'missing') addError(errors, 'area_rear', 'Required')
    if (!['MIT', 'OHNE'].includes(parseRequiredString(fields.installation) ?? '')) addError(errors, 'installation', 'Required')
    if (fields.installation === 'MIT' && requireBoolPresent(fields.existing_wrap) === 'missing') addError(errors, 'existing_wrap', 'Required')
    if (fields.installation === 'MIT' && !parseIsoDate(fields.installation_date)) addError(errors, 'installation_date', 'Valid date')
  } else if (lfpType === 'OTHER_LFP') {
    if (!parseRequiredString(fields.description)) addError(errors, 'description', 'Required')
  }
  return errors
}
