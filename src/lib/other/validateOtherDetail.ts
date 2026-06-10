/**
 * Validation for the "Other" (Sonstige) department product.
 *
 * The Other department is the catch-all bucket for products that don't fit one
 * of the specialized departments (Stamp, Textile, LFP, CopyShop, Laser). It has
 * a single product type, `OTHER`, mapped to the `other_products` child table.
 *
 * Operates on the English typed fields of an Other product: the child column
 * `description` plus the parent `quantity`. Field keys are English; returned
 * error keys are English too. There is no type discriminator beyond OTHER.
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
 * Validate an Other product's English fields against its current status.
 *
 * Returns a map of field-key → error message (rendered inline next to the form
 * field). An empty map means the product is valid.
 *
 * Status-dependent rules:
 * - `QUOTE` (quote stage): nothing required, returns empty.
 * - Any later status: `description` becomes mandatory.
 *
 * `quantity` is always optional but, if provided, must be a positive integer.
 *
 * @param fields English child columns + the parent `quantity`
 */
export function validateOtherDetail(
  fields: Record<string, unknown>,
  subOrderStatus: OrderStatus,
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!parseRequiredString(fields.description)) addError(errors, 'description', 'Required')
  if (!isQuantityValidIfPresent(fields.quantity)) addError(errors, 'quantity', 'Integer ≥ 1')
  return errors
}
