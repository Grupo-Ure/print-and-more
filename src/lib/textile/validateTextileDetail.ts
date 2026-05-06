/**
 * Validation helpers for Textile sub-orders.
 *
 * Textile differs from the other departments in that the bulk of its
 * data lives in three related tables (`textil_motive`,
 * `textil_positionen`, `textil_zuordnungen`) rather than in the JSONB
 * `detail` column. This module therefore exposes:
 *
 * - {@link textileDetailMarkedComplete}: a fast check on the JSONB
 *   `detail.textil.voll` flag — written by the UI once the motif /
 *   position / assignment dataset has reached a state that allows
 *   prepress release.
 * - {@link textileRecordsAllowPrepress}: the full multi-row check
 *   against the related tables (used by the UI to decide whether to
 *   write the `voll` flag).
 * - {@link buildFreeSizeString}: helper that encodes a free-text size
 *   into the `groesse` column with a `FREI:` prefix.
 * - {@link isUniqueViolation}: detects PostgREST unique-constraint
 *   errors so the caller can show a localized message.
 */

import type {
  TextileSize,
  TextileMotifRow,
  TextilePositionRow,
  TextileAssignmentRow,
} from '../../types/textile'

const GROESSE_NORM: TextileSize[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

/**
 * Cheap check used by the order-status pipeline: returns true iff the
 * sub-order's JSONB `detail.textil.voll` flag is set. The UI writes
 * this flag after {@link textileRecordsAllowPrepress} returns true.
 */
export function textileDetailMarkedComplete(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return false
  const t = (detail as { textil?: { voll?: boolean } }).textil
  if (!t || typeof t !== 'object') return false
  return t.voll === true
}

function groesseIstGesetzt(g: string | null | undefined): boolean {
  if (g == null) return false
  const s = String(g).trim()
  if (!s) return false
  if (GROESSE_NORM.includes(s as TextileSize)) return true
  if (s.startsWith('FREI:')) {
    return s.length > 5
  }
  return false
}

function zuordnungDatensatzVoll(z: { motiv_id: string; position_id: string }): boolean {
  return Boolean(z.motiv_id?.trim() && z.position_id?.trim())
}

/**
 * Whether the related-table dataset (motifs + positions + assignments)
 * meets the business rules for an automatic prepress transition (no
 * customer-approval handshake required):
 *
 * - At least one motif, position, and assignment row.
 * - Every assignment links a present motif and position.
 * - Every motif has a placement, size, and either text content + color
 *   + font class (TEXT typ) or a file id (DATEI typ).
 * - Every position has a positive integer quantity, and either typ +
 *   color (KUNDENWARE) or brand + model + color + size (EIGENWARE).
 */
export function textileRecordsAllowPrepress(
  motive: TextileMotifRow[],
  positionen: TextilePositionRow[],
  zuordnungen: Pick<TextileAssignmentRow, 'motiv_id' | 'position_id'>[]
): boolean {
  if (motive.length < 1 || positionen.length < 1) return false
  if (zuordnungen.length < 1) return false
  for (const z of zuordnungen) {
    if (!zuordnungDatensatzVoll(z)) return false
  }
  for (const m of motive) {
    if (!m.platz?.trim()) return false
    if (!groesseIstGesetzt(m.groesse)) return false
    if (m.typ === 'TEXT') {
      if (!m.inhalt?.trim() || !m.farbe?.trim() || !m.schriftklasse?.trim()) return false
    } else {
      if (!m.datei_id) return false
    }
  }
  for (const p of positionen) {
    if (p.stueckzahl < 1 || !Number.isInteger(p.stueckzahl)) return false
    if (p.herkunft === 'KUNDENWARE') {
      if (!p.typ?.trim() || !p.farbe?.trim()) return false
    } else {
      if (!p.marke?.trim() || !p.modell?.trim() || !p.farbe?.trim() || !p.groesse?.trim()) return false
    }
  }
  return true
}

/** Encode a millimeter free-text size into the `groesse` column format. */
export function buildFreeSizeString(mm: string): string {
  return `FREI:${mm.trim()}`
}

/** Detect Postgres unique-constraint errors (SQLSTATE 23505). */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').toLowerCase().includes('unique')
}
