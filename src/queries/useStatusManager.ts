import { useEffect } from 'react'
import { deriveAutomaticStatus } from '../lib/status/automaticStatus'
import { useOrderById } from './orderQueries'
import { useProductsByJobId } from './productQueries'
import { useEffectiveJob, useSetJobStatus } from './jobQueries'

/**
 * The status manager: watches one job's cached data and persists the
 * automatic `IN_SETUP ↔ PREPRESS` transition. Mounted once per auto-band job
 * of the open order via `StatusManager` (a single writer per job), so the
 * transition fires when the underlying data changes — not on tab selection.
 * It does NOT touch IN_PRODUCTION / DONE rows, and does not do bounce-back.
 *
 * Mechanism: read current state from the cache (queries), compute the target status
 * with the pure `deriveAutomaticStatus`, and — only if it differs from the stored
 * value — persist it via `useSetJobStatus` (which patches the job cache and
 * reconciles the order status + sidebar). The persisted change re-runs this effect,
 * where the computed value now equals the stored one, so it converges in one extra pass.
 *
 * Completeness is judged on the *effective* job (inherited common fields resolved
 * against the order) via `useEffectiveJob`. The customer is read straight off the
 * order (`order.customers`, already joined in by `getOrderById`) — the order row does
 * not carry a separate `customer_id` column. Load guard: products is read as an input;
 * while still loading its `data` is `undefined`, which would look like "no content" and
 * could spuriously retract a PREPRESS row, so we wait until it has loaded.
 */
export function useStatusManager(orderId: string | null, jobId: string | null): void {
  const effectiveJob = useEffectiveJob(orderId, jobId)
  const { data: products } = useProductsByJobId(jobId)
  const { data: order } = useOrderById(orderId)
  const { mutate: setJobStatus } = useSetJobStatus()

  useEffect(() => {
    if (!orderId || !order || !effectiveJob) return
    // Gate: only the auto band, never cancelled rows.
    if (effectiveJob.is_cancelled) return
    if (effectiveJob.status !== 'IN_SETUP' && effectiveJob.status !== 'PREPRESS') return
    // Wait for the products query to load before acting (undefined = still loading).
    if (products === undefined) return

    const customer = order.customers // joined onto the order; no separate fetch
    const next = deriveAutomaticStatus(effectiveJob, products.length > 0, customer, order.status)
    if (next !== effectiveJob.status) {
      setJobStatus({
        id: effectiveJob.id,
        orderId,
        status: next,
        // Log the automatic promotion; the retraction (PREPRESS → IN_SETUP) stays silent.
        history: next === 'PREPRESS' ? { event_type: 'PREPRESS_READY_AUTO' } : undefined,
      })
    }
  }, [orderId, effectiveJob, products, order, setJobStatus])
}
