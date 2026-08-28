/**
 * Shared building blocks for the per-product-type schemas.
 *
 * The schemas reproduce the old department validators **exactly**, so the raw
 * parsers below are copied verbatim from those validators (parseRequiredString,
 * parseMmDimension, parsePositiveInt(Mm), requireBoolPresent, parseIsoDate,
 * isValidQuantity, isQuantityValidIfPresent, parseIntWithMin, hasDimension).
 * Keeping them here as plain functions guarantees byte-for-byte parity.
 *
 * Pattern used by every schema:
 *
 *   z.object(loose([...keys]))            // lenient base — fields never error,
 *     .transform((d, ctx) => {            //   so this pass ALWAYS runs
 *       // imperative validation: ctx.addIssue({ path:['field'], message })
 *       return { …typed child columns + quantity }   // drives z.infer (drift)
 *     })
 *
 * A lenient base is required because Zod skips a `.superRefine`/`.transform`
 * refinement pass when a *field-level* schema (one that uses `.transform`, like
 * our Stage-1 primitives) fails — which would drop independent errors the old
 * validators emit together. With every field typed `z.unknown().optional()` the
 * base never fails, so the single validation pass always runs and accumulates
 * every issue exactly like the imperative code.
 */

import { z } from 'zod'

/** Lenient base object: every key present but never erroring. */
export function loose<const K extends readonly string[]>(keys: K) {
  const shape: Record<string, z.ZodOptional<z.ZodUnknown>> = {}
  for (const k of keys) shape[k] = z.unknown().optional()
  return z.object(shape)
}

// ---------------------------------------------------------------------------
// Raw parsers — copied verbatim from the department validators.
// ---------------------------------------------------------------------------

/** Trim and require non-empty. Returns the trimmed string or `null`. */
export function parseRequiredString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Trim, then require membership in `allowed`. */
export function parseEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  const trimmed = parseRequiredString(value)
  if (!trimmed) return null
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T[number]) : null
}

/** Boolean must be explicitly true or false (not absent). */
export function requireBoolPresent(value: unknown): 'ok' | 'missing' {
  if (value === true || value === false) return 'ok'
  return 'missing'
}

/** Positive float millimeter; accepts comma or dot decimals. */
export function parseMmDimension(value: unknown): number | null {
  if (value === '' || value == null) return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/** Positive integer (≥ 1); `parseInt` for strings. Used by Stamp width/height. */
export function parsePositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

/** Positive integer millimeter (≥ 1). Used by LFP/Laser dimensions + diameters. */
export function parsePositiveIntMm(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

/** Validate an ISO date string; returns the YYYY-MM-DD prefix or `null`. */
export function parseIsoDate(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return value.slice(0, 10)
}

/** Quantity must be a positive integer (≥ 1). */
export function isValidQuantity(value: unknown): boolean {
  if (value == null || value === '') return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 1
}

/** If provided, must be an integer ≥ 1. Empty / null / undefined is valid. */
export function isQuantityValidIfPresent(value: unknown): boolean {
  if (value == null || value === '') return true
  if (typeof value === 'number' && Number.isNaN(value)) return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return false
  return Number.isInteger(parsed) && parsed >= 1
}

/** Integer ≥ `min`, or `null`. Used by CopyShop page counts. */
export function parseIntWithMin(value: unknown, min: number): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < min) return null
  return parsed
}

// ---------------------------------------------------------------------------
// Output coercers — feed the schema's typed output (z.infer → drift assertion).
// Return `| null` so the inferred shape is assignable to the child Insert
// (whose columns are `T | null`).
// ---------------------------------------------------------------------------

/** Trimmed string or null (child text/enum columns). */
export const strOut = (v: unknown): string | null => parseRequiredString(v)
/** Float mm or null. */
export const mmOut = (v: unknown): number | null => parseMmDimension(v)
/** Integer mm or null. */
export const intMmOut = (v: unknown): number | null => parsePositiveIntMm(v)
/** Explicit boolean or null. */
export const boolOut = (v: unknown): boolean | null => (v === true || v === false ? v : null)
/** Quantity as a number or null (parent column, required-int rule lives in the schema). */
export const qtyOut = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const parsed = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(parsed) ? parsed : null
}
/** Integer-ish numeric child column (e.g. rollup_width, page_count) → number | null. */
export const numOut = qtyOut

export const MSG_FORMAT_MASSE = 'Provide at least width or height'

/** At least one dimension present, using the float parser (LFP / CopyShop). */
export const hasDimensionFloat = (width: unknown, height: unknown): boolean =>
  parseMmDimension(width) != null || parseMmDimension(height) != null

/** At least one dimension present, using the integer parser (Laser). */
export const hasDimensionIntMm = (width: unknown, height: unknown): boolean =>
  parsePositiveIntMm(width) != null || parsePositiveIntMm(height) != null
