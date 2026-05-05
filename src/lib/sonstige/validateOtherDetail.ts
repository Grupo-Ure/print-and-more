/**
 * Validation for the "Other" (Sonstige) department's sub-order detail.
 *
 * The Other department is the catch-all bucket for sub-orders that don't
 * fit one of the specialized departments (Stamp, Textile, LFP, CopyShop,
 * Laser). Its detail shape is intentionally minimal: a free-text
 * description and an optional integer quantity.
 */

import type { AuftragStatus } from '../../types/database'

/** Trim and require non-empty. Returns the trimmed string or `null`. */
function reqStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

/** If provided, must be an integer ≥ 1. Empty / null / undefined is valid. */
function stueckzahlOptional(v: unknown): boolean {
  if (v == null || v === '') return true
  if (typeof v === 'number' && Number.isNaN(v)) return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (Number.isNaN(n)) return false
  return Number.isInteger(n) && n >= 1
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

/**
 * Validate an Other sub-order's detail JSON against its current status.
 *
 * Returns a map of field-key → German error message (rendered inline next
 * to the form field). An empty map means the detail is valid.
 *
 * Status-dependent rules:
 * - `ANGEBOT` (quote stage): nothing required, returns empty.
 * - Any later status: `beschreibung` becomes mandatory.
 *
 * `stueckzahl` is always optional but, if provided, must be a positive
 * integer.
 */
export function validateOtherDetail(
  d: Record<string, unknown> | null,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!reqStr(d?.beschreibung)) f(o, 'beschreibung', 'Pflichtfeld')
  if (d && !stueckzahlOptional(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  return o
}
