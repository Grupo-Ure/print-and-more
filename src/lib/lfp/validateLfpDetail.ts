/**
 * Validation for LFP (Large Format Print) sub-order detail.
 *
 * Each LFP `typ` (sticker, UV sign, foil sign, vinyl plot, banner, rollup,
 * vehicle wrap, misc) has its own required fields inside the `detail`
 * JSONB column. {@link validateLfpDetail} returns a map of field-key →
 * German error message (rendered inline next to the form field). An
 * empty map means the detail is valid.
 *
 * Status-dependent rule: in `ANGEBOT` (quote stage) nothing is required
 * regardless of typ.
 */

import { LFP_TYPES, type LfpDetail, type LfpType } from '../../types/lfp'
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
 * Validate an LFP sub-order's typ + detail against its current status.
 *
 * Returns a map of field-key → German error message; empty map means
 * valid. In `ANGEBOT` no fields are required. Otherwise the typ must be
 * one of {@link LFP_TYPES}, `stueckzahl` must be a positive integer, and
 * the typ-specific keys (material, dimensions, options, etc.) must be set.
 */
export function validateLfpDetail(
  typ: string | null,
  detail: LfpDetail,
  subOrderStatus: OrderStatus
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!typ || !LFP_TYPES.includes(typ as LfpType)) {
    addError(errors, 'typ', 'Select type')
    return errors
  }
  if (!isValidQuantity(detail.stueckzahl)) addError(errors, 'stueckzahl', 'Integer ≥ 1')

  const lfpType = typ as LfpType
  if (lfpType === 'AUFKLEBER') {
    if (!['3551', 'ULTRATACK', 'MONSTERTACK', '3162'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['FREIFORM', 'RECHTECK'].includes(parseRequiredString(detail.konturschnitt) ?? '')) addError(errors, 'konturschnitt', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminat) ?? '')) addError(errors, 'laminat', 'Required')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(detail.ausgabe) ?? '')) addError(errors, 'ausgabe', 'Required')
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'SCHILD_UV') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(detail.druckseite) ?? '')) addError(errors, 'druckseite', 'Required')
    if (detail.material === 'ACRYLGLAS') {
      if (!['VORDERSEITE', 'RUECKSEITE'].includes(parseRequiredString(detail.acryl_druckrichtung) ?? '')) addError(errors, 'acryl_druckrichtung', 'Required')
    }
    if (requireBoolPresent(detail.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Required')
    if (requireBoolPresent(detail.bohrungen) === 'missing') addError(errors, 'bohrungen', 'Required')
    if (detail.bohrungen === true) {
      if (parsePositiveIntMm(detail.bohrungen_durchmesser) == null) addError(errors, 'bohrungen_durchmesser', 'Integer (mm) ≥ 1')
      if (!parseRequiredString(detail.bohrungen_position)) addError(errors, 'bohrungen_position', 'Required')
    }
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'SCHILD_FOLIE') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(detail.druckseite) ?? '')) addError(errors, 'druckseite', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminat) ?? '')) addError(errors, 'laminat', 'Required')
    if (requireBoolPresent(detail.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Required')
    if (requireBoolPresent(detail.bohrungen) === 'missing') addError(errors, 'bohrungen', 'Required')
    if (detail.bohrungen === true) {
      if (parsePositiveIntMm(detail.bohrungen_durchmesser) == null) addError(errors, 'bohrungen_durchmesser', 'Integer (mm) ≥ 1')
      if (!parseRequiredString(detail.bohrungen_position)) addError(errors, 'bohrungen_position', 'Required')
    }
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'FOLIENPLOTT') {
    if (!['751C', '631', '8510'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(detail.ausgabe) ?? '')) addError(errors, 'ausgabe', 'Required')
  } else if (lfpType === 'BANNER') {
    if (!['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
    if (requireBoolPresent(detail.saum) === 'missing') addError(errors, 'saum', 'Required')
    if (requireBoolPresent(detail.oesen) === 'missing') addError(errors, 'oesen', 'Required')
    if (detail.oesen === true) {
      if (!parseRequiredString(detail.oesen_detail)) addError(errors, 'oesen_detail', 'Required')
    }
  } else if (lfpType === 'ROLLUP') {
    if (!['PVC_FRONTLIT', 'ROLLUP_FILM'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['NEUE_KASSETTE', 'MOTIVTAUSCH'].includes(parseRequiredString(detail.system) ?? '')) addError(errors, 'system', 'Required')
    const width = Number(detail.breite)
    if (width !== 85 && width !== 100) addError(errors, 'breite', 'Select width 85 or 100 cm')
  } else if (lfpType === 'FAHRZEUGBESCHRIFTUNG') {
    if (!parseRequiredString(detail.marke)) addError(errors, 'marke', 'Required')
    if (!parseRequiredString(detail.modell)) addError(errors, 'modell', 'Required')
    if (requireBoolPresent(detail.bereiche_seiten) === 'missing') addError(errors, 'bereiche_seiten', 'Required')
    if (requireBoolPresent(detail.bereiche_front) === 'missing') addError(errors, 'bereiche_front', 'Required')
    if (requireBoolPresent(detail.bereiche_heck) === 'missing') addError(errors, 'bereiche_heck', 'Required')
    if (!['MIT', 'OHNE'].includes(parseRequiredString(detail.montage) ?? '')) addError(errors, 'montage', 'Required')
    if (detail.montage === 'MIT' && requireBoolPresent(detail.altbeklebung) === 'missing') addError(errors, 'altbeklebung', 'Required')
    if (detail.montage === 'MIT' && !parseIsoDate(detail.montagetermin)) addError(errors, 'montagetermin', 'Valid date')
  } else if (lfpType === 'SONSTIGE_LFP') {
    if (!parseRequiredString(detail.beschreibung)) addError(errors, 'beschreibung', 'Required')
  }
  return errors
}
