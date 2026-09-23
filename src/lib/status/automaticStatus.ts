import type { Customer, JobStatus, OrderStatus, JobRow } from '../../types/database'
import { isDeadlineMissed, isJobComplete } from '../jobShared'
import { customerMeetsPrepressContact } from '../customer'

/**
 * The automatic `IN_SETUP ↔ PREPRESS` decision — a pure function of the
 * job's *current* state. The status manager calls this only for a job
 * whose status is already `IN_SETUP` or `PREPRESS` (the caller gates out
 * committed / cancelled rows), so the return value is always one of those two.
 *
 * The same rules apply to every department and product type — a job in the
 * OTHER department advances exactly like a CopyShop one:
 * - Not complete → `IN_SETUP`.
 * - Missed deadline → an `IN_SETUP` job stays `IN_SETUP` (entry gate only; a job
 *   already in `PREPRESS` is not retracted). This is the one clock dependency —
 *   `isDeadlineMissed` compares against today's date.
 * - Complete → `PREPRESS` when the customer-contact requirement is met, else
 *   `IN_SETUP` (auto-advance + retract).
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

  if (!isJobComplete(job, orderIsQuote, hasContent)) return 'IN_SETUP'

  // A missed deadline blocks the *entry* into pre-press; it never pulls a job back.
  if (job.status === 'IN_SETUP' && isDeadlineMissed(job)) return 'IN_SETUP'

  if (!customerMeetsPrepressContact(customer)) return 'IN_SETUP'

  return orderIsQuote ? 'IN_SETUP' : 'PREPRESS'
}
