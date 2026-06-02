/**
 * Validation for laser-engraving sub-order detail.
 *
 * {@link validateLaserDetail} returns a map of field-key → German error
 * message (rendered inline next to the form field). An empty map means
 * the detail is valid.
 *
 * Per-typ rules at a glance:
 * - Sign typen (SIGN / TROPHY_PLATE / NAME_TAG): material from
 *   {@link LASER_SIGN_MATERIALS}, at least one dimension, corner-rounding
 *   flag, motif. SIGN and TROPHY_PLATE additionally need the
 *   self-adhesive flag.
 * - GIFT_ITEM: free-text material, origin (customer / in-house),
 *   motif.
 * - OTHER_LASER: self-adhesive flag, origin, motif.
 *
 * In `ANGEBOT` (quote stage) nothing is required regardless of typ.
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
 * Validate a laser sub-order's typ + detail against its current status.
 *
 * Returns a map of field-key → German error message; empty map means
 * valid. In `ANGEBOT` no fields are required. Otherwise the typ must be
 * one of {@link LASER_TYPES}, `stueckzahl` must be a positive integer,
 * and the typ-specific keys (material, dimensions, options, etc.) must
 * be set.
 */
export function validateLaserDetail(
  typ: string | null,
  detail: Record<string, unknown> | null,
  subOrderStatus: OrderStatus
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!typ || !LASER_TYPES.includes(typ as LaserType)) {
    addError(errors, 'typ', 'Select type')
    return errors
  }
  if (!isValidQuantity(detail?.stueckzahl)) addError(errors, 'stueckzahl', 'Integer ≥ 1')

  const laserType = typ as LaserType

  if (laserType === 'SIGN' || laserType === 'TROPHY_PLATE' || laserType === 'NAME_TAG') {
    const material = parseRequiredString(detail?.material) as (typeof LASER_SIGN_MATERIALS)[number] | null
    if (!material || !LASER_SIGN_MATERIALS.includes(material as (typeof LASER_SIGN_MATERIALS)[number])) {
      addError(errors, 'material', 'Required')
    }
    if (material === 'SONSTIGE' && !parseRequiredString(detail?.material_sonstige)) addError(errors, 'material_sonstige', 'Required')
    if (!hasDimension(detail?.format_breite, detail?.format_hoehe)) addError(errors, 'format_masse', MSG_FORMAT_MASSE)
    if (requireBoolPresent(detail?.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Required')
    if ((laserType === 'SIGN' || laserType === 'TROPHY_PLATE') && requireBoolPresent(detail?.selbstklebend) === 'missing') {
      addError(errors, 'selbstklebend', 'Required')
    }
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Required')
  } else if (laserType === 'GIFT_ITEM') {
    if (!parseRequiredString(detail?.material_freitext)) addError(errors, 'material_freitext', 'Required')
    const origin = parseRequiredString(detail?.herkunft)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'herkunft', 'Required')
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Required')
  } else if (laserType === 'OTHER_LASER') {
    if (requireBoolPresent(detail?.selbstklebend) === 'missing') addError(errors, 'selbstklebend', 'Required')
    const origin = parseRequiredString(detail?.herkunft)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'herkunft', 'Required')
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Required')
  }

  return errors
}
