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

const STANDARD_SIZES: TextileSize[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

/**
 * Cheap check used by the order-status pipeline: returns true iff the
 * sub-order's JSONB `detail.textil.voll` flag is set. The UI writes
 * this flag after {@link textileRecordsAllowPrepress} returns true.
 */
export function textileDetailMarkedComplete(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return false
  const textilSection = (detail as { textil?: { voll?: boolean } }).textil
  if (!textilSection || typeof textilSection !== 'object') return false
  return textilSection.voll === true
}

function isSizeSet(size: string | null | undefined): boolean {
  if (size == null) return false
  const trimmed = String(size).trim()
  if (!trimmed) return false
  if (STANDARD_SIZES.includes(trimmed as TextileSize)) return true
  if (trimmed.startsWith('FREI:')) {
    return trimmed.length > 5
  }
  return false
}

function isAssignmentComplete(assignment: { motif_id: string; position_id: string }): boolean {
  return Boolean(assignment.motif_id?.trim() && assignment.position_id?.trim())
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
  motifs: TextileMotifRow[],
  positions: TextilePositionRow[],
  assignments: Pick<TextileAssignmentRow, 'motif_id' | 'position_id'>[]
): boolean {
  if (motifs.length < 1 || positions.length < 1) return false
  if (assignments.length < 1) return false
  for (const assignment of assignments) {
    if (!isAssignmentComplete(assignment)) return false
  }
  for (const motif of motifs) {
    if (!motif.placement?.trim()) return false
    if (!isSizeSet(motif.size)) return false
    if (motif.type === 'TEXT') {
      if (!motif.content?.trim() || !motif.color?.trim() || !motif.font_class?.trim()) return false
    } else {
      if (!motif.file_id) return false
    }
  }
  for (const position of positions) {
    if (position.quantity < 1 || !Number.isInteger(position.quantity)) return false
    if (position.origin === 'CUSTOMER_STOCK') {
      if (!position.type?.trim() || !position.color?.trim()) return false
    } else {
      if (!position.brand?.trim() || !position.model?.trim() || !position.color?.trim() || !position.size?.trim()) return false
    }
  }
  return true
}

/** Encode a millimeter free-text size into the `groesse` column format. */
export function buildFreeSizeString(sizeInMm: string): string {
  return `FREI:${sizeInMm.trim()}`
}

/** Detect Postgres unique-constraint errors (SQLSTATE 23505). */
export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').toLowerCase().includes('unique')
}
