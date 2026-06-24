import { useEffect } from 'react'
import { deriveAutomaticStatus } from '../lib/status/automaticStatus'
import { useOrderById } from './orderQueries'
import { useProductsBySubOrderId } from './productQueries'
import { useEffectiveSubOrder, useSetSubOrderStatus } from './subOrderQueries'

/**
 * The status manager: watches the active sub-order's cached data and persists the
 * automatic `INCOMPLETE ↔ PREPRESS_READY` transition. Mounted once, for the active
 * sub-order (a single writer). It does NOT touch QUOTE / PRODUCTION_READY / DONE /
 * INVOICED / emergency rows, and does not do bounce-back.
 *
 * Mechanism: read current state from the cache (queries), compute the target status
 * with the pure `deriveAutomaticStatus`, and — only if it differs from the stored
 * value — persist it via `useSetSubOrderStatus` (which patches the sub-order cache and
 * reconciles the order status + sidebar). The persisted change re-runs this effect,
 * where the computed value now equals the stored one, so it converges in one extra pass.
 *
 * Completeness is judged on the *effective* sub-order (inherited common fields resolved
 * against the order) via `useEffectiveSubOrder`. The customer is read straight off the
 * order (`order.customers`, already joined in by `getOrderById`) — the order row does
 * not carry a separate `customer_id` column. Load guard: products is read as an input;
 * while still loading its `data` is `undefined`, which would look like "no content" and
 * could spuriously retract a PREPRESS_READY row, so we wait until it has loaded.
 */
export function useStatusManager(orderId: string | null, activeSubOrderId: string | null): void {
  const effectiveSubOrder = useEffectiveSubOrder(orderId, activeSubOrderId)
  const { data: products } = useProductsBySubOrderId(activeSubOrderId)
  const { data: order } = useOrderById(orderId)
  const { mutate: setSubOrderStatus } = useSetSubOrderStatus()

  useEffect(() => {
    if (!orderId || !order || !effectiveSubOrder) return
    // Gate: only the auto band, never emergency or cancelled rows.
    if (effectiveSubOrder.is_cancelled || effectiveSubOrder.is_emergency) return
    if (effectiveSubOrder.status !== 'INCOMPLETE' && effectiveSubOrder.status !== 'PREPRESS_READY') return
    // Wait for the products query to load before acting (undefined = still loading).
    if (products === undefined) return

    const customer = order.customers // joined onto the order; no separate fetch
    const next = deriveAutomaticStatus(effectiveSubOrder, products.length > 0, customer, order.status)
    if (next !== effectiveSubOrder.status) {
      setSubOrderStatus({ id: effectiveSubOrder.id, orderId, status: next })
    }
  }, [orderId, effectiveSubOrder, products, order, setSubOrderStatus])
}
