/**
 * Cross-Bereich helpers shared by every job detail mask.
 *
 * Every job — regardless of its production department — runs the
 * same set of common-field checks (delivery, deadline, priority,
 * assignee, typesetting time) plus shared inheritance/eligibility helpers.
 * This module is the single home for those, so per-department detail
 * components (`StampDetail`, `TextileDetail`, `LFPDetail`, etc.) all
 * delegate here.
 *
 * Key exports:
 * - {@link resolveEffectiveJob}: resolve inherited common fields against the order.
 * - {@link validateJobCommonFields}: per-field error map for the common header.
 * - {@link isJobComplete}: common-field check + per-department content flag.
 * - {@link autoPrepressAllowed}: per-department auto-prepress eligibility (used by the
 *   status manager's `deriveAutomaticStatus`).
 *
 * String values like `'STAMP'`, `'OTHER_STAMP'`, status enums,
 * etc. mirror the Postgres enums and stay German; only the TypeScript
 * identifier surface is English here.
 */

import { type DeliveryChoice, type Priority, type JobRow } from '../types/database'

/**
 * Resolve a job's inherited common fields against its order. A null
 * `delivery` / `priority` / `deadline` column means "inherit from the order"; this
 * returns a copy of the job with those three resolved to their effective
 * values (delivery falling back to `PICKUP` when the order has none). Use this
 * before `validateJobCommonFields` / `isJobComplete` so completeness
 * judges the *effective* fields, not the raw (often-null, inheriting) columns.
 *
 * Single source of truth for the resolution — consumed by `JobDetail` (display
 * + validation), the status manager (auto-advance completeness), and ContextPanel's
 * manual prepress check.
 */
export function resolveEffectiveJob<
  T extends Pick<JobRow, 'delivery' | 'priority' | 'deadline'>,
>(
  job: T,
  order: { delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
): T {
  return {
    ...job,
    delivery: job.delivery ?? order.delivery ?? 'PICKUP',
    priority: job.priority ?? order.priority,
    deadline: job.deadline ?? order.deadline,
  }
}

const UUID_LOOSE = /^[0-9a-fA-F-]{30,40}$/

/**
 * Whether the status manager is allowed to auto-advance this job into
 * PREPRESS without an explicit user action.
 *
 * Default is allowed; explicitly excluded:
 * - Stamp `OTHER_STAMP` (free-form descriptions need manual review).
 * - Anything in the Other (`SONSTIGE`) Bereich.
 * - Laser `OTHER_LASER` and LFP `OTHER_LFP` (same reason).
 *
 * Inside Stamp, only the structured typen are auto-advanced.
 */
export function autoPrepressAllowed(merged: JobRow): boolean {
  if (merged.department === 'STAMP') {
    if (merged.type === 'OTHER_STAMP') return false
    return (
      merged.type === 'TRODAT_PRINTY' ||
      merged.type === 'WOODEN_STAMP' ||
      merged.type === 'STAND_STAMP' ||
      merged.type === 'DATE_STAMP' ||
      merged.type === 'REFILL_INK' ||
      merged.type === 'INK_PAD' ||
      merged.type === 'TRODAT_PAD' ||
      merged.type === 'STAMP_PLATE'
    )
  }
  if (merged.department === 'OTHER') return false
  if (merged.department === 'LASER_ENGRAVING' && merged.type === 'OTHER_LASER') return false
  if (merged.department === 'LFP' && merged.type === 'OTHER_LFP') return false
  return true
}

/**
 * Validate the common header fields every job carries (delivery,
 * deadline, priority, assignee UUID).
 *
 * Returns a map of field-key → error message; empty map means valid.
 * While the parent order is still a QUOTE nothing is required — the
 * quote-relaxation is an *order*-level rule, so callers pass
 * `orderIsQuote` from the order, never from the job.
 */
export function validateJobCommonFields(
  job: Pick<JobRow, 'deadline' | 'delivery' | 'priority' | 'assignee_id'>,
  orderIsQuote: boolean
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (orderIsQuote) return errors
  if (job.delivery !== 'PICKUP' && job.delivery !== 'SHIPPING') errors.lieferung = 'Required'
  if (!job.deadline) errors.termin = 'Required'
  if (job.priority !== 'NORMAL' && job.priority !== 'HIGH') {
    errors.prioritaet = 'Required'
  }
  const rawAssigneeId = job.assignee_id
  const assigneeId = typeof rawAssigneeId === 'string' ? rawAssigneeId.trim() : ''
  if (assigneeId && !UUID_LOOSE.test(assigneeId)) errors.verantwortlicher_id = 'Valid UUID'
  return errors
}

/**
 * Whether the job is complete enough to advance from IN_SETUP. While the
 * parent order is a QUOTE, always true (nothing required yet). Otherwise:
 * common header fields must be valid, and the per-department content check
 * must pass — at least one product exists (`hasProducts`, derived by the
 * caller from the product query).
 */
/** The job fields the completeness check reads — full `JobRow`s always qualify. */
export type JobCompletenessFields = Pick<
  JobRow,
  | 'department'
  | 'status'
  | 'is_cancelled'
  | 'deadline'
  | 'delivery'
  | 'priority'
  | 'assignee_id'
>

export function isJobComplete(
  job: JobCompletenessFields,
  orderIsQuote: boolean,
  hasProducts: boolean,
): boolean {
  if (orderIsQuote) return true
  const errors = validateJobCommonFields(job, orderIsQuote)
  if (Object.keys(errors).length > 0) return false
  if (
    job.department === 'LFP' ||
    job.department === 'COPYSHOP' ||
    job.department === 'STAMP' ||
    job.department === 'LASER_ENGRAVING' ||
    job.department === 'OTHER' ||
    job.department === 'TEXTILE'
  ) {
    return hasProducts
  }
  return true
}

/**
 * Derived alert: the job sits in production but fails the completeness check —
 * the trace a force release leaves behind (or a required field cleared after a
 * regular release). Purely derived, no stored flag: it appears while the info
 * is missing and disappears once someone back-fills it. Shown as a warning icon
 * on the order (sidebar) and the job (job list).
 */
export function isInProductionMissingInfo(
  job: JobCompletenessFields,
  order: { delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
  hasProducts: boolean,
): boolean {
  if (job.status !== 'IN_PRODUCTION' || job.is_cancelled) return false
  // A job in production implies the order is past QUOTE — validate strictly.
  return !isJobComplete(resolveEffectiveJob(job, order), false, hasProducts)
}


/**
 * Short form of a job number for contexts already scoped to one order:
 * strips the `<order_number>` prefix and keeps the identifying
 * `<DEPT>-<NN>` suffix (e.g. `2026-07-0042-LFP-01` → `LFP-01`). The order
 * number itself contains dashes, so "last two segments" is the robust cut.
 */
export function shortJobNumber(jobNumber: string): string {
  return jobNumber.split('-').slice(-2).join('-')
}
