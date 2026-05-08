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

const MSG_MASSE = 'Mindestens Breite oder Höhe angeben'

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
  if (subOrderStatus === 'ANGEBOT') return errors
  if (!typ || !LFP_TYPES.includes(typ as LfpType)) {
    addError(errors, 'typ', 'Typ wählen')
    return errors
  }
  if (!isValidQuantity(detail.stueckzahl)) addError(errors, 'stueckzahl', 'Ganze Zahl ≥ 1')

  const lfpType = typ as LfpType
  if (lfpType === 'AUFKLEBER') {
    if (!['3551', 'ULTRATACK', 'MONSTERTACK', '3162'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!['FREIFORM', 'RECHTECK'].includes(parseRequiredString(detail.konturschnitt) ?? '')) addError(errors, 'konturschnitt', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminat) ?? '')) addError(errors, 'laminat', 'Pflichtfeld')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(detail.ausgabe) ?? '')) addError(errors, 'ausgabe', 'Pflichtfeld')
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'SCHILD_UV') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(detail.druckseite) ?? '')) addError(errors, 'druckseite', 'Pflichtfeld')
    if (detail.material === 'ACRYLGLAS') {
      if (!['VORDERSEITE', 'RUECKSEITE'].includes(parseRequiredString(detail.acryl_druckrichtung) ?? '')) addError(errors, 'acryl_druckrichtung', 'Pflichtfeld')
    }
    if (requireBoolPresent(detail.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Pflichtfeld')
    if (requireBoolPresent(detail.bohrungen) === 'missing') addError(errors, 'bohrungen', 'Pflichtfeld')
    if (detail.bohrungen === true) {
      if (parsePositiveIntMm(detail.bohrungen_durchmesser) == null) addError(errors, 'bohrungen_durchmesser', 'Ganze Zahl (mm) ≥ 1')
      if (!parseRequiredString(detail.bohrungen_position)) addError(errors, 'bohrungen_position', 'Pflichtfeld')
    }
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'SCHILD_FOLIE') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(detail.druckseite) ?? '')) addError(errors, 'druckseite', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminat) ?? '')) addError(errors, 'laminat', 'Pflichtfeld')
    if (requireBoolPresent(detail.ecken_runden) === 'missing') addError(errors, 'ecken_runden', 'Pflichtfeld')
    if (requireBoolPresent(detail.bohrungen) === 'missing') addError(errors, 'bohrungen', 'Pflichtfeld')
    if (detail.bohrungen === true) {
      if (parsePositiveIntMm(detail.bohrungen_durchmesser) == null) addError(errors, 'bohrungen_durchmesser', 'Ganze Zahl (mm) ≥ 1')
      if (!parseRequiredString(detail.bohrungen_position)) addError(errors, 'bohrungen_position', 'Pflichtfeld')
    }
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (lfpType === 'FOLIENPLOTT') {
    if (!['751C', '631', '8510'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!['EINZEL', 'BOGEN'].includes(parseRequiredString(detail.ausgabe) ?? '')) addError(errors, 'ausgabe', 'Pflichtfeld')
  } else if (lfpType === 'BANNER') {
    if (!['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
    if (requireBoolPresent(detail.saum) === 'missing') addError(errors, 'saum', 'Pflichtfeld')
    if (requireBoolPresent(detail.oesen) === 'missing') addError(errors, 'oesen', 'Pflichtfeld')
    if (detail.oesen === true) {
      if (!parseRequiredString(detail.oesen_detail)) addError(errors, 'oesen_detail', 'Pflichtfeld')
    }
  } else if (lfpType === 'ROLLUP') {
    if (!['PVC_FRONTLIT', 'ROLLUP_FILM'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Pflichtfeld')
    if (!['NEUE_KASSETTE', 'MOTIVTAUSCH'].includes(parseRequiredString(detail.system) ?? '')) addError(errors, 'system', 'Pflichtfeld')
    const width = Number(detail.breite)
    if (width !== 85 && width !== 100) addError(errors, 'breite', 'Breite 85 oder 100 cm wählen')
  } else if (lfpType === 'FAHRZEUGBESCHRIFTUNG') {
    if (!parseRequiredString(detail.marke)) addError(errors, 'marke', 'Pflichtfeld')
    if (!parseRequiredString(detail.modell)) addError(errors, 'modell', 'Pflichtfeld')
    if (requireBoolPresent(detail.bereiche_seiten) === 'missing') addError(errors, 'bereiche_seiten', 'Pflichtfeld')
    if (requireBoolPresent(detail.bereiche_front) === 'missing') addError(errors, 'bereiche_front', 'Pflichtfeld')
    if (requireBoolPresent(detail.bereiche_heck) === 'missing') addError(errors, 'bereiche_heck', 'Pflichtfeld')
    if (!['MIT', 'OHNE'].includes(parseRequiredString(detail.montage) ?? '')) addError(errors, 'montage', 'Pflichtfeld')
    if (detail.montage === 'MIT' && requireBoolPresent(detail.altbeklebung) === 'missing') addError(errors, 'altbeklebung', 'Pflichtfeld')
    if (detail.montage === 'MIT' && !parseIsoDate(detail.montagetermin)) addError(errors, 'montagetermin', 'Gültiges Datum')
  } else if (lfpType === 'SONSTIGE_LFP') {
    if (!parseRequiredString(detail.beschreibung)) addError(errors, 'beschreibung', 'Pflichtfeld')
  }
  return errors
}
