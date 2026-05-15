/**
 * Validation for the "Other" (Sonstige) department's sub-order detail.
 *
 * The Other department is the catch-all bucket for sub-orders that don't
 * fit one of the specialized departments (Stamp, Textile, LFP, CopyShop,
 * Laser). Its detail shape is intentionally minimal: a free-text
 * description and an optional integer quantity.
 */

import type { OrderStatus } from '../../types/database'

/** Trim and require non-empty. Returns the trimmed string or `null`. */
function parseRequiredString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** If provided, must be an integer ≥ 1. Empty / null / undefined is valid. */
function isQuantityValidIfPresent(value: unknown): boolean {
  if (value == null || value === '') return true
  if (typeof value === 'number' && Number.isNaN(value)) return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return false
  return Number.isInteger(parsed) && parsed >= 1
}

type Err = Record<string, string>
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
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
  detail: Record<string, unknown> | null,
  subOrderStatus: OrderStatus
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!parseRequiredString(detail?.beschreibung)) addError(errors, 'beschreibung', 'Required')
  if (detail && !isQuantityValidIfPresent(detail.stueckzahl)) addError(errors, 'stueckzahl', 'Integer ≥ 1')
  return errors
}
