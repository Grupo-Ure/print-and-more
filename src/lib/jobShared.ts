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
 *
 * String values like `'STAMP'`, `'OTHER_STAMP'`, status enums,
 * etc. mirror the Postgres enums and stay German; only the TypeScript
 * identifier surface is English here.
 */

import { format } from 'date-fns'
import { type DeliveryChoice, type Priority, type JobRow, type OrderStatus } from '../types/database'
import { toDateOnly } from './formatDate'

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
 * Whether the job is past setup (pre-press or production) with nobody
 * assigned. A warning only — it never blocks a release or the order.
 */
export function isMissingAssignee(job: Pick<JobRow, 'status' | 'is_cancelled' | 'assignee_id'>): boolean {
  if (job.is_cancelled) return false
  return (job.status === 'PREPRESS' || job.status === 'IN_PRODUCTION') && !job.assignee_id
}

/**
 * Whether the open job's effective deadline (its own, else the order's) lies
 * strictly before today, local time. Done and cancelled jobs never count. A
 * warning only — a past deadline blocks nothing.
 */
export function isDeadlineMissed(
  job: Pick<JobRow, 'status' | 'is_cancelled' | 'deadline'>,
  order: { deadline: string | null },
  now: Date = new Date(),
): boolean {
  if (job.is_cancelled || job.status === 'DONE') return false
  const deadline = toDateOnly(job.deadline ?? order.deadline)
  return deadline != null && deadline < format(now, 'yyyy-MM-dd')
}

/**
 * Whether the open job has no effective deadline (neither its own nor the
 * order's) once the order is past quote. A warning only — the release gates
 * enforce the deadline through `isJobComplete`, not through this.
 */
export function isMissingDeadline(
  job: Pick<JobRow, 'status' | 'is_cancelled' | 'deadline'>,
  order: { status: OrderStatus; deadline: string | null },
): boolean {
  if (job.is_cancelled || job.status === 'DONE' || order.status === 'QUOTE') return false
  return !(job.deadline ?? order.deadline)
}

/**
 * Derived alert: the job has no deadline, is past setup with nobody assigned,
 * or sits in production but fails the completeness check — the trace a force
 * release leaves behind (or a required field cleared after a regular release).
 * Purely derived, no stored flag: it appears while the info is missing and
 * disappears once someone back-fills it. Shown as a warning icon on the order
 * (sidebar) and the job (job list); it never blocks anything.
 */
export function isMissingInfo(
  job: JobCompletenessFields,
  order: { status: OrderStatus; delivery: DeliveryChoice | null; priority: Priority; deadline: string | null },
  hasProducts: boolean,
): boolean {
  if (isMissingAssignee(job) || isMissingDeadline(job, order)) return true
  if (job.status !== 'IN_PRODUCTION' || job.is_cancelled) return false
  // A job in production implies the order is past QUOTE — validate strictly.
  return !isJobComplete(resolveEffectiveJob(job, order), false, hasProducts)
}

/**
 * True when the order's work is complete: at least one non-cancelled job and
 * every one of them is DONE. Cancelled jobs do not count either way. This is
 * the condition for the order's "Mark finished" action and for the automatic
 * finish (`deriveAutomaticOrderStatus`).
 */
export function areAllJobsDone(jobs: readonly Pick<JobRow, 'status' | 'is_cancelled'>[]): boolean {
  const live = jobs.filter(job => !job.is_cancelled)
  return live.length > 0 && live.every(job => job.status === 'DONE')
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
