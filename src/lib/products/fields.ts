/**
 * Shared Zod primitives for per-product-type schemas.
 *
 * Each primitive replicates — field-for-field — a hand-rolled parser from the
 * department validators being replaced (cross-checked against
 * `src/lib/lfp/validateLfpDetail.ts` and `src/lib/stamp/validateStampDetail.ts`).
 *
 * Shape: primitives are absent-tolerant. Optional dimension parsers transform
 * `''` / `null` → `undefined` (absent) and parse comma decimals; the
 * "present-but-invalid" per-field error and "at least one" OR-checks (e.g.
 * width-or-height → the synthetic `'format'` key) are composed in the per-type
 * schemas via `.superRefine`, not baked in here. This keeps the primitives
 * small and composable.
 *
 * Stored enum VALUE strings stay German (SCHWARZ, FREIFORM, MATT, MIT, …) —
 * only field *keys* are English. Do not translate stored values.
 */

import { z } from 'zod'

/**
 * Trim and require a non-empty string. Mirrors `parseRequiredString`:
 * non-string or whitespace-only is invalid.
 */
export function requiredString(message = 'Required') {
  return z
    .string({ error: message })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { error: message })
}

/**
 * Positive integer ≥ 1, accepting a number or a numeric string. Mirrors
 * `isValidQuantity` / `parsePositiveInt`: `''` / `null` / non-integer → invalid.
 * Uses `parseInt` semantics for string input.
 */
export function positiveInt(message = 'Integer ≥ 1') {
  return z.preprocess((value) => {
    if (value == null || value === '') return Number.NaN
    return typeof value === 'number' ? value : parseInt(String(value), 10)
  }, z.number().int().min(1, { error: message }).refine((n) => Number.isInteger(n) && n >= 1, { error: message }))
}

/**
 * Parent `quantity` field — same rule as {@link positiveInt}.
 */
export function quantity(message = 'Integer ≥ 1') {
  return positiveInt(message)
}

/**
 * Optional positive millimeter dimension; accepts comma OR dot decimals.
 * Mirrors `parseMmDimension`: `''` / `null` → absent (`undefined`); otherwise
 * `parseFloat(String(v).replace(',', '.'))`, must be finite and > 0.
 *
 * Returns `number | undefined`. Per-field "present-but-invalid" reporting and
 * OR-checks are layered in the schema via `.superRefine`.
 */
export function mmDimension() {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === '' || value == null) return undefined
      const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
      if (!Number.isFinite(parsed) || parsed <= 0) return undefined
      return parsed
    })
    .optional()
}

/**
 * Optional positive integer millimeter value. Mirrors `parsePositiveIntMm`:
 * `''` / `null` / non-integer / `< 1` → absent (`undefined`); `parseInt`
 * semantics for string input.
 */
export function positiveIntMm() {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null || value === '') return undefined
      const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
      if (!Number.isInteger(parsed) || parsed < 1) return undefined
      return parsed
    })
    .optional()
}

/**
 * Enum over stored VALUE strings (kept German). Trims string input before
 * matching, mirroring `parseEnum`.
 */
export function germanEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  message = 'Required',
) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.enum(values, { error: message }),
  )
}

/**
 * ISO date string. Mirrors `parseIsoDate`: must be a non-empty string that
 * `new Date()` parses to a valid time; returns the `YYYY-MM-DD` prefix.
 */
export function isoDate(message = 'Valid date') {
  return z
    .string({ error: message })
    .refine((value) => {
      if (value.trim() === '') return false
      const date = new Date(value)
      return !Number.isNaN(date.getTime())
    }, { error: message })
    .transform((value) => value.slice(0, 10))
}

/**
 * Boolean that must be explicitly `true` or `false`. Mirrors
 * `requireBoolPresent`: absent / non-boolean is invalid.
 */
export function requiredBool(message = 'Required') {
  return z.boolean({ error: message })
}
