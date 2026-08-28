import type { Customer, JobStatus, OrderStatus, JobRow } from '../../types/database'
import { autoPrepressAllowed, isJobComplete } from '../jobShared'
import { customerMeetsPrepressContact } from '../customer'

/**
 * The automatic `IN_SETUP ↔ PREPRESS` decision — a pure function of the
 * job's *current* state. The status manager calls this only for a job
 * whose status is already `IN_SETUP` or `PREPRESS` (the caller gates out
 * committed / cancelled rows), so the return value is always one of those two.
 *
 * Rules:
 * - Not complete → `IN_SETUP`.
 * - Structured (auto-prepress-eligible) type → advance to `PREPRESS` when the
 *   customer-contact requirement is met, else `IN_SETUP` (auto-advance + retract).
 * - Free-form type (OTHER department, OTHER_* types) → never auto-advances, but a
 *   manually-released `PREPRESS` is kept while still complete (retract-only).
 * - QUOTE cap: while the *order* is still `QUOTE`, `PREPRESS` is capped back to
 *   `IN_SETUP` (you cannot prepress before the order is accepted). This is the
 *   one deliberate place the order lifecycle feeds into the job workflow.
 *
 * `hasContent` is the per-department content flag the caller supplies (currently
 * `products.length > 0`, matching `isJobComplete` and the manual prepress button).
 */
export function deriveAutomaticStatus(
  job: JobRow,
  hasContent: boolean,
  customer: Customer | null | undefined,
  orderStatus: OrderStatus,
): JobStatus {
  const orderIsQuote = orderStatus === 'QUOTE'
  const cap = (status: JobStatus): JobStatus =>
    orderIsQuote && status === 'PREPRESS' ? 'IN_SETUP' : status

  if (!isJobComplete(job, orderIsQuote, hasContent)) return 'IN_SETUP'

  if (autoPrepressAllowed(job)) {
    return customerMeetsPrepressContact(customer) ? cap('PREPRESS') : 'IN_SETUP'
  }

  // Free-form / manual-only: no auto-advance; keep a manual PREPRESS while complete.
  return job.status === 'PREPRESS' ? cap('PREPRESS') : 'IN_SETUP'
}
