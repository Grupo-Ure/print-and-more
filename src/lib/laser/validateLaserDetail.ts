/**
 * Validation for laser-engraving products.
 *
 * Operates on the English typed fields of a laser product (the child columns
 * plus the parent `quantity`), keyed by `type`. Field keys are English; the
 * stored enum VALUE strings (ABS_SW, KUNDENMATERIAL, …) are kept as-is for now
 * (the value→English pass is deferred, shop-confirmed).
 *
 * Per-type rules at a glance:
 * - Sign types (SIGN / TROPHY_PLATE / NAME_TAG): material from
 *   {@link LASER_SIGN_MATERIALS}, at least one dimension, round-corners
 *   flag, motif. SIGN and TROPHY_PLATE additionally need the
 *   self-adhesive flag.
 * - GIFT_ITEM: free-text material, origin (customer / in-house), motif.
 * - OTHER_LASER: self-adhesive flag, origin, motif.
 *
 * In `QUOTE` (quote stage) nothing is required regardless of type. Returns a
 * map of field-key → message; empty map means valid.
 */

import {
  LASER_ORIGINS,
  LASER_SIGN_MATERIALS,
  type LaserType,
  LASER_TYPES,
} from '../../types/laser'
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

/** At least one dimension (width or height) is a positive integer. */
function hasDimension(width: unknown, height: unknown): boolean {
  return parsePositiveIntMm(width) != null || parsePositiveIntMm(height) != null
}

type Err = Record<string, string>
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
}

const MSG_FORMAT_MASSE = 'Provide at least width or height'

/**
 * Validate a laser product's type + English child fields against its current
 * status.
 *
 * @param type   the product type discriminator
 * @param fields English child columns + the parent `quantity`
 *
 * Returns a map of field-key → message; empty map means valid. In `QUOTE` no
 * fields are required. Otherwise the type must be one of {@link LASER_TYPES},
 * `quantity` must be a positive integer, and the type-specific keys
 * (material, dimensions, options, etc.) must be set.
 */
export function validateLaserDetail(
  type: string | null,
  fields: Record<string, unknown>,
  subOrderStatus: OrderStatus
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!type || !LASER_TYPES.includes(type as LaserType)) {
    addError(errors, 'type', 'Select type')
    return errors
  }
  if (!isValidQuantity(fields.quantity)) addError(errors, 'quantity', 'Integer ≥ 1')

  const laserType = type as LaserType

  if (laserType === 'SIGN' || laserType === 'TROPHY_PLATE' || laserType === 'NAME_TAG') {
    const material = parseRequiredString(fields.material) as (typeof LASER_SIGN_MATERIALS)[number] | null
    if (!material || !LASER_SIGN_MATERIALS.includes(material as (typeof LASER_SIGN_MATERIALS)[number])) {
      addError(errors, 'material', 'Required')
    }
    if (material === 'SONSTIGE' && !parseRequiredString(fields.material_other)) addError(errors, 'material_other', 'Required')
    if (!hasDimension(fields.width, fields.height)) addError(errors, 'format', MSG_FORMAT_MASSE)
    if (requireBoolPresent(fields.round_corners) === 'missing') addError(errors, 'round_corners', 'Required')
    if ((laserType === 'SIGN' || laserType === 'TROPHY_PLATE') && requireBoolPresent(fields.self_adhesive) === 'missing') {
      addError(errors, 'self_adhesive', 'Required')
    }
    if (!parseRequiredString(fields.motif)) addError(errors, 'motif', 'Required')
  } else if (laserType === 'GIFT_ITEM') {
    if (!parseRequiredString(fields.material_free_text)) addError(errors, 'material_free_text', 'Required')
    const origin = parseRequiredString(fields.origin)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'origin', 'Required')
    if (!parseRequiredString(fields.motif)) addError(errors, 'motif', 'Required')
  } else if (laserType === 'OTHER_LASER') {
    if (requireBoolPresent(fields.self_adhesive) === 'missing') addError(errors, 'self_adhesive', 'Required')
    const origin = parseRequiredString(fields.origin)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'origin', 'Required')
    if (!parseRequiredString(fields.motif)) addError(errors, 'motif', 'Required')
  }

  return errors
}
