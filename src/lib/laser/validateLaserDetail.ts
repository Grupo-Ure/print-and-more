/**
 * Validation for laser-engraving sub-order detail.
 *
 * {@link validateLaserDetail} returns a map of field-key → German error
 * message (rendered inline next to the form field). An empty map means
 * the detail is valid.
 *
 * Per-typ rules at a glance:
 * - Sign typen (SCHILD / POKALSCHILD / NAMENSSCHILD): material from
 *   {@link LASER_SIGN_MATERIALS}, at least one dimension, corner-rounding
 *   flag, motif. SCHILD and POKALSCHILD additionally need the
 *   self-adhesive flag.
 * - GESCHENKARTIKEL: free-text material, origin (customer / in-house),
 *   motif.
 * - SONSTIGE_LASER: self-adhesive flag, origin, motif.
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

const MSG_FORMAT_MASSE = 'Mindestens Breite oder Höhe angeben'

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
    addError(errors, 'typ', 'Typ wählen')
    return errors
  }
  if (!isValidQuantity(detail?.stueckzahl)) addError(errors, 'stueckzahl', 'Ganze Zahl ≥ 1')

  const laserType = typ as LaserType

  if (laserType === 'SCHILD' || laserType === 'POKALSCHILD' || laserType === 'NAMENSSCHILD') {
    const material = parseRequiredString(detail?.material) as (typeof LASER_SIGN_MATERIALS)[number] | null
    if (!material || !LASER_SIGN_MATERIALS.includes(material as (typeof LASER_SIGN_MATERIALS)[number])) {
      addError(errors, 'material', 'Pflichtfeld')
    }
    if (material === 'SONSTIGE' && !parseRequiredString(detail?.material_sonstige)) addError(errors, 'material_sonstige', 'Pflichtfeld')
    if (!hasDimension(detail?.format_breite, detail?.format_hoehe)) addError(errors, 'format_masse', MSG_FORMAT_MASSE)
    if (requireBoolPresent(detail?.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Pflichtfeld')
    if ((laserType === 'SCHILD' || laserType === 'POKALSCHILD') && requireBoolPresent(detail?.selbstklebend) === 'missing') {
      addError(errors, 'selbstklebend', 'Pflichtfeld')
    }
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Pflichtfeld')
  } else if (laserType === 'GESCHENKARTIKEL') {
    if (!parseRequiredString(detail?.material_freitext)) addError(errors, 'material_freitext', 'Pflichtfeld')
    const origin = parseRequiredString(detail?.herkunft)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'herkunft', 'Pflichtfeld')
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Pflichtfeld')
  } else if (laserType === 'SONSTIGE_LASER') {
    if (requireBoolPresent(detail?.selbstklebend) === 'missing') addError(errors, 'selbstklebend', 'Pflichtfeld')
    const origin = parseRequiredString(detail?.herkunft)
    if (!origin || !LASER_ORIGINS.includes(origin as (typeof LASER_ORIGINS)[number])) addError(errors, 'herkunft', 'Pflichtfeld')
    if (!parseRequiredString(detail?.motiv)) addError(errors, 'motiv', 'Pflichtfeld')
  }

  return errors
}
