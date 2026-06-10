/**
 * Adapter from a Zod validation error to the `Record<string, string>`
 * field-error contract used by the product validators and the detail
 * components. This keeps the per-type schemas a drop-in replacement for the
 * old `validate*Detail` functions.
 */

import type { z } from 'zod'

/**
 * Map a `ZodError` to `field-key → message`.
 *
 * - The key is `String(issue.path[0])` — the top-level field. Synthetic /
 *   path-less keys such as `'format'` (the width-or-height OR-check) and
 *   `'type'` are preserved verbatim; schemas emit them by setting an explicit
 *   `path` on the issue (e.g. `ctx.addIssue({ path: ['format'], … })`).
 * - First issue wins per key, matching the old single-message-per-field
 *   `addError` behaviour.
 * - Issues with an empty path are dropped (every product rule targets a field).
 */
export function zodIssuesToFieldMap(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    if (issue.path.length === 0) continue
    const key = String(issue.path[0])
    if (key in errors) continue
    errors[key] = issue.message
  }
  return errors
}
