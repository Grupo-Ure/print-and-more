import type { OrderStatus, SubOrderRow } from '../types/database'

// Mirrors the explicit CASE ordering of the former Postgres fn_calculate_order_status.
// Statuses not in the production workflow (QUOTE, INVOICED) rank as 0 so they sort
// alongside the SQL function's ELSE branch — i.e. they would "win" as the lowest if
// they ever appeared in a non-cancelled sub-order. In practice sub-orders only carry
// INCOMPLETE / PREPRESS_READY / PRODUCTION_READY / DONE.
const STATUS_RANK: Record<OrderStatus, number> = {
  QUOTE: 0,
  INVOICED: 0,
  INCOMPLETE: 1,
  PREPRESS_READY: 2,
  PRODUCTION_READY: 3,
  DONE: 4,
}

/**
 * Aggregate order status derived from its sub-orders.
 *
 * - If the order is currently QUOTE, leave it as QUOTE (never auto-promoted).
 * - Otherwise return the lowest status across non-cancelled sub-orders.
 * - If there are no non-cancelled sub-orders, return INCOMPLETE.
 */
export function calculateOrderStatus(
  currentStatus: OrderStatus,
  subOrders: Pick<SubOrderRow, 'status' | 'is_cancelled'>[],
): OrderStatus {
  if (currentStatus === 'QUOTE') return 'QUOTE'

  const activeStatuses = subOrders
    .filter(s => !s.is_cancelled)
    .map(s => s.status)

  if (activeStatuses.length === 0) return 'INCOMPLETE'

  return activeStatuses.reduce((lowest, candidate) =>
    STATUS_RANK[candidate] < STATUS_RANK[lowest] ? candidate : lowest,
  )
}
