import type { Customer, OrderStatus, JobRow } from '../../types/database'
import { autoPrepressAllowed, isJobComplete } from '../jobShared'
import { customerMeetsPrepressContact } from '../customer'

/**
 * The automatic `INCOMPLETE ↔ PREPRESS_READY` decision — a pure function of the
 * job's *current* state. The status manager calls this only for a job
 * whose status is already `INCOMPLETE` or `PREPRESS_READY` (the caller gates out
 * QUOTE / committed / cancelled rows), so the return value is always
 * one of those two.
 *
 * Rules:
 * - Not complete → `INCOMPLETE`.
 * - Structured (auto-prepress-eligible) type → advance to `PREPRESS_READY` when the
 *   customer-contact requirement is met, else `INCOMPLETE` (auto-advance + retract).
 * - Free-form type (OTHER department, OTHER_* types) → never auto-advances, but a
 *   manually-released `PREPRESS_READY` is kept while still complete (retract-only).
 * - QUOTE cap: while the order is still `QUOTE`, `PREPRESS_READY` is capped back to
 *   `INCOMPLETE` (you cannot prepress before the order is accepted).
 *
 * `hasContent` is the per-department content flag the caller supplies (currently
 * `products.length > 0`, matching `isJobComplete` and the manual prepress button).
 */
export function deriveAutomaticStatus(
  job: JobRow,
  hasContent: boolean,
  customer: Customer | null | undefined,
  orderStatus: OrderStatus,
): OrderStatus {
  const cap = (status: OrderStatus): OrderStatus =>
    orderStatus === 'QUOTE' && status === 'PREPRESS_READY' ? 'INCOMPLETE' : status

  if (!isJobComplete(job, job.status, hasContent)) return 'INCOMPLETE'

  if (autoPrepressAllowed(job)) {
    return customerMeetsPrepressContact(customer) ? cap('PREPRESS_READY') : 'INCOMPLETE'
  }

  // Free-form / manual-only: no auto-advance; keep a manual PREPRESS_READY while complete.
  return job.status === 'PREPRESS_READY' ? cap('PREPRESS_READY') : 'INCOMPLETE'
}
