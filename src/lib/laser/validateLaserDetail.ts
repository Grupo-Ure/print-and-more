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
import type { AuftragStatus } from '../../types/database'

/** Trim and require non-empty. Returns the trimmed string or `null`. */
function reqStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

/** Boolean must be explicitly true or false (not absent). */
function reqBool(v: unknown): 'ok' | 'missing' {
  if (v === true || v === false) return 'ok'
  return 'missing'
}

/** Quantity must be a positive integer (≥ 1). */
function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

/** Positive integer millimeter value, or `null` if invalid/missing. */
function posGanzzahlMm(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

/** At least one dimension (width or height) is a positive integer. */
function formatMindestEins(b: unknown, h: unknown): boolean {
  return posGanzzahlMm(b) != null || posGanzzahlMm(h) != null
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
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
  d: Record<string, unknown> | null,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!typ || !LASER_TYPES.includes(typ as LaserType)) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  if (!stueckzahlGueltig(d?.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')

  const t = typ as LaserType

  if (t === 'SCHILD' || t === 'POKALSCHILD' || t === 'NAMENSSCHILD') {
    const m = reqStr(d?.material) as (typeof LASER_SIGN_MATERIALS)[number] | null
    if (!m || !LASER_SIGN_MATERIALS.includes(m as (typeof LASER_SIGN_MATERIALS)[number])) {
      f(o, 'material', 'Pflichtfeld')
    }
    if (m === 'SONSTIGE' && !reqStr(d?.material_sonstige)) f(o, 'material_sonstige', 'Pflichtfeld')
    if (!formatMindestEins(d?.format_breite, d?.format_hoehe)) f(o, 'format_masse', MSG_FORMAT_MASSE)
    if (reqBool(d?.ecken_runden) === 'missing') f(o, 'ecken_runden', 'Pflichtfeld')
    if ((t === 'SCHILD' || t === 'POKALSCHILD') && reqBool(d?.selbstklebend) === 'missing') {
      f(o, 'selbstklebend', 'Pflichtfeld')
    }
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  } else if (t === 'GESCHENKARTIKEL') {
    if (!reqStr(d?.material_freitext)) f(o, 'material_freitext', 'Pflichtfeld')
    const h = reqStr(d?.herkunft)
    if (!h || !LASER_ORIGINS.includes(h as (typeof LASER_ORIGINS)[number])) f(o, 'herkunft', 'Pflichtfeld')
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  } else if (t === 'SONSTIGE_LASER') {
    if (reqBool(d?.selbstklebend) === 'missing') f(o, 'selbstklebend', 'Pflichtfeld')
    const h = reqStr(d?.herkunft)
    if (!h || !LASER_ORIGINS.includes(h as (typeof LASER_ORIGINS)[number])) f(o, 'herkunft', 'Pflichtfeld')
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  }

  return o
}
