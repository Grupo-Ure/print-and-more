import type { Customer, OrderStatus, PaymentMethod, ProductRow, ProductStatus } from '../../types/database'
import { areAllProductsDone, isProductComplete, type ProductCompletenessFields } from '../productShared'
import { customerMeetsPrepressContact } from '../customer'

/**
 * The automatic `IN_SETUP ↔ PREPRESS` decision — a pure function of the
 * product's *current* state. The status manager calls this only for a product
 * whose status is already `IN_SETUP` or `PREPRESS` (the caller gates out
 * committed / cancelled rows), so the return value is always one of those two.
 *
 * The same rules apply to every department and product type — a product in the
 * OTHER department advances exactly like a CopyShop one:
 * - Not complete → `IN_SETUP`. With the job gone, completeness is the effective
 *   deadline being set; a past deadline does not count against it (see
 *   `isProductComplete`).
 * - Complete → `PREPRESS` when the customer-contact requirement is met, else
 *   `IN_SETUP` (auto-advance + retract).
 * - QUOTE cap: while the *order* is still `QUOTE`, `PREPRESS` is capped back to
 *   `IN_SETUP` (you cannot prepress before the order is accepted). This is the
 *   one deliberate place the order lifecycle feeds into the product workflow.
 *
 * `product` is the *effective* product — inherited fields already resolved
 * against the order (see `resolveEffectiveProduct`).
 */
export function deriveAutomaticStatus(
  product: ProductCompletenessFields,
  customer: Customer | null | undefined,
  orderStatus: OrderStatus,
): ProductStatus {
  const orderIsQuote = orderStatus === 'QUOTE'

  if (!isProductComplete(product, orderIsQuote)) return 'IN_SETUP'

  if (!customerMeetsPrepressContact(customer)) return 'IN_SETUP'

  return orderIsQuote ? 'IN_SETUP' : 'PREPRESS'
}

/**
 * The automatic `IN_PROGRESS → FINISHED` decision — a pure function of the
 * order and its products. Returns `FINISHED` when the order's work is complete
 * (see `areAllProductsDone`), otherwise the order's current status unchanged.
 *
 * - Only an `IN_PROGRESS` order moves; quotes cannot have done products, and a
 *   finished order is left where the admin's reopen put it.
 * - Only invoice orders: `FINISHED` means "produced, invoice pending". A cash
 *   order skips that state — its close (`BILLED` + archived) records the
 *   payment at the counter, which the last product being done says nothing
 *   about, so it stays a manual "Finish & close".
 *
 * Applied on the events that can complete the order's work (a product marked
 * done, cancelled or deleted), never as a standing watcher — otherwise a
 * reopened order would finish itself again before anything could change.
 */
export function deriveAutomaticOrderStatus(
  order: { status: OrderStatus; payment_method: PaymentMethod },
  products: readonly Pick<ProductRow, 'status' | 'is_cancelled'>[],
): OrderStatus {
  if (order.status !== 'IN_PROGRESS') return order.status
  if (order.payment_method !== 'INVOICE') return order.status
  return areAllProductsDone(products) ? 'FINISHED' : order.status
}
