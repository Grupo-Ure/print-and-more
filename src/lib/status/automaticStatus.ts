import type { Customer, JobStatus, OrderStatus, JobRow, PaymentMethod } from '../../types/database'
import { areAllJobsDone, isJobComplete } from '../jobShared'
import { customerMeetsPrepressContact } from '../customer'

/**
 * The automatic `IN_SETUP ↔ PREPRESS` decision — a pure function of the
 * job's *current* state. The status manager calls this only for a job
 * whose status is already `IN_SETUP` or `PREPRESS` (the caller gates out
 * committed / cancelled rows), so the return value is always one of those two.
 *
 * The same rules apply to every department and product type — a job in the
 * OTHER department advances exactly like a CopyShop one:
 * - Not complete → `IN_SETUP`. A past deadline does not count against
 *   completeness — only a missing one does (see `isJobComplete`).
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

  if (!customerMeetsPrepressContact(customer)) return 'IN_SETUP'

  return orderIsQuote ? 'IN_SETUP' : 'PREPRESS'
}

/**
 * The automatic `IN_PROGRESS → FINISHED` decision — a pure function of the
 * order and its jobs. Returns `FINISHED` when the order's work is complete
 * (see `areAllJobsDone`), otherwise the order's current status unchanged.
 *
 * - Only an `IN_PROGRESS` order moves; quotes cannot have done jobs, and a
 *   finished order is left where the admin's reopen put it.
 * - Only invoice orders: `FINISHED` means "produced, invoice pending". A cash
 *   order skips that state — its close (`BILLED` + archived) records the
 *   payment at the counter, which the last job being done says nothing about,
 *   so it stays a manual "Finish & close".
 *
 * Applied on the events that can complete the order's work (a job marked
 * done, cancelled or deleted), never as a standing watcher — otherwise a
 * reopened order would finish itself again before anything could change.
 */
export function deriveAutomaticOrderStatus(
  order: { status: OrderStatus; payment_method: PaymentMethod },
  jobs: readonly Pick<JobRow, 'status' | 'is_cancelled'>[],
): OrderStatus {
  if (order.status !== 'IN_PROGRESS') return order.status
  if (order.payment_method !== 'INVOICE') return order.status
  return areAllJobsDone(jobs) ? 'FINISHED' : order.status
}
