import { useEffect } from 'react'
import { deriveAutomaticStatus } from '../lib/status/automaticStatus'
import { resolveEffectiveProduct } from '../lib/productShared'
import { useOrderById } from './orderQueries'
import { useProductsByOrderId, useSetProductStatus } from './productQueries'

/**
 * The status manager: watches the open order's cached products and persists the
 * automatic `IN_SETUP ↔ PREPRESS` transition for each of them. Called once per
 * open order — by `OrderDetails`, and by `ProductionProductPanel` when the
 * product is edited from the production view — so there is a single writer per
 * order and a transition fires when the underlying data changes, not on
 * selecting a product. It does NOT touch IN_PRODUCTION / DONE rows, and does
 * not do bounce-back.
 *
 * The job model needed one watcher per job, because each job kept its products
 * in a query of its own; the order's products now share one cache, so one
 * effect covers them all. That also makes the order-wide promotion explicit:
 * setting the order's deadline completes every inheriting product at once, and
 * they all move up together.
 *
 * Mechanism: read current state from the cache (queries), compute each
 * product's target status with the pure `deriveAutomaticStatus`, and — only
 * where it differs from the stored value — persist it via `useSetProductStatus`
 * (which patches the product cache and reconciles the order lists). The
 * persisted change re-runs this effect, where the computed value now equals the
 * stored one, so it converges in one extra pass.
 *
 * Completeness is judged on the *effective* product (inherited common fields
 * resolved against the order). The customer is read straight off the order
 * (`order.customers`, already joined in by `getOrderById`) — the order row does
 * not carry a separate `customer_id` column.
 */
export function useStatusManager(orderId: string | null): void {
  const { data: products } = useProductsByOrderId(orderId)
  const { data: order } = useOrderById(orderId)
  const { mutate: setProductStatus } = useSetProductStatus()

  useEffect(() => {
    if (!orderId || !order || !products) return

    const customer = order.customers // joined onto the order; no separate fetch
    for (const product of products) {
      // Gate: only the auto band, never cancelled rows.
      if (product.is_cancelled) continue
      if (product.status !== 'IN_SETUP' && product.status !== 'PREPRESS') continue

      const next = deriveAutomaticStatus(
        resolveEffectiveProduct(product, order),
        customer,
        order.status,
      )
      if (next === product.status) continue
      setProductStatus({
        id: product.id,
        orderId,
        status: next,
        // Log the automatic promotion; the retraction (PREPRESS → IN_SETUP) stays silent.
        history: next === 'PREPRESS' ? { event_type: 'PREPRESS_READY_AUTO' } : undefined,
      })
    }
  }, [orderId, products, order, setProductStatus])
}
