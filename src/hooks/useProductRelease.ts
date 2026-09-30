import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { WORKFLOW_STATUSES } from '../const/orderStatus'
import { isProductComplete, resolveEffectiveProduct } from '../lib/productShared'
import { deriveAutomaticOrderStatus } from '../lib/status/automaticStatus'
import {
  useFinishOrderWhenAllProductsDone,
  useForceReleaseToProduction,
  useProductsByOrderId,
  useReleaseToProduction,
  useSetProductStatus,
} from '../queries/productQueries'
import { useOrderById } from '../queries/orderQueries'
import { useStockAvailability } from '../queries/stockQueries'
import { useIsAdmin } from '../queries/userQueries'
import { InsufficientStockError } from '../services/productionReleaseService'
import type { LoadedProduct } from '../types/product'
import type { ProductStatus } from '../types/database'

/** Label of the action that advances a product out of the given status. */
const ADVANCE_LABELS: Partial<Record<ProductStatus, string>> = {
  IN_SETUP: 'Release to Pre-Press',
  PREPRESS: 'Release to Production',
  IN_PRODUCTION: 'Mark product as done',
}

export type ProductRelease = {
  /** Status the advance moves to; null when there is none (DONE) or the order is still a quote. */
  target: ProductStatus | null
  /** Label of the advance action; null exactly when `target` is. */
  label: string | null
  pending: boolean
  /** True while the advance is blocked by a gate or a mutation is in flight. */
  disabled: boolean
  approvalBlocked: boolean
  /** Admins may bypass the completeness/stock gates while one of them is failing. */
  canForceRelease: boolean
  /** Confirms with the user, then advances the product one workflow step. */
  advance: () => Promise<void>
  /** Admin override past the completeness/stock gates; resolves true on success. */
  forceRelease: (reason: string) => Promise<boolean>
}

/**
 * The single forward action of a product's workflow — IN_SETUP → PREPRESS →
 * IN_PRODUCTION → DONE — with its gates (completeness, customer approval,
 * stock) and confirmations. Shared by the release button in the product header
 * and the product list's context menu so both enforce the same rules.
 */
export function useProductRelease(product: LoadedProduct, orderNumber: string | null): ProductRelease {
  const setProductStatus = useSetProductStatus()
  const releaseToProduction = useReleaseToProduction()
  const forceReleaseMutation = useForceReleaseToProduction()
  const finishOrderWhenAllProductsDone = useFinishOrderWhenAllProductsDone()
  const { showError } = useToast()
  const confirm = useConfirm()
  const { isAdmin } = useIsAdmin()
  const orderQuery = useOrderById(product.order_id)
  const { data: siblings = [] } = useProductsByOrderId(product.order_id)
  const { data: shortages = [] } = useStockAvailability(product)

  const order = orderQuery.data
  const orderIsQuote = order?.status === 'QUOTE'
  const stockBlocked = shortages.length > 0
  // Completeness is judged on the effective product, and strictly: the quote
  // relaxation is irrelevant here, since nothing advances while the order is a quote.
  const complete = order ? isProductComplete(resolveEffectiveProduct(product, order), false) : false

  // The next status on the workflow track — none once the product is DONE.
  // Nothing advances while the order is still a quote.
  const nextIndex = WORKFLOW_STATUSES.indexOf(product.status) + 1
  const nextStatus: ProductStatus | null =
    nextIndex < WORKFLOW_STATUSES.length ? WORKFLOW_STATUSES[nextIndex] : null
  const label = ADVANCE_LABELS[product.status] ?? null
  const available = nextStatus != null && label != null && !orderIsQuote

  const pending =
    setProductStatus.isPending || releaseToProduction.isPending || forceReleaseMutation.isPending

  // Customer approval blocks any release to production — including a forced
  // one; only the completeness and stock gates are overridable.
  const approvalBlocked =
    product.customer_approval_required === true && product.customer_approval_granted !== true

  const disabled =
    pending ||
    (product.status === 'IN_SETUP' && !complete) ||
    (product.status === 'PREPRESS' && (approvalBlocked || stockBlocked))

  // The override is offered only while a gate it can bypass is actually
  // failing; once the product validates the normal release covers it.
  const canForceRelease =
    isAdmin &&
    ((product.status === 'IN_SETUP' && !complete) ||
      (product.status === 'PREPRESS' && stockBlocked))

  const releaseToPrepress = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Release this product to pre-press?',
      confirmLabel: 'Release',
    })
    if (!confirmed) return
    try {
      await setProductStatus.mutateAsync({
        id: product.id,
        orderId: product.order_id,
        status: 'PREPRESS',
        history: { event_type: 'PREPRESS_READY_MANUAL' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const releaseProductToProduction = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Release this product to production?',
      description:
        product.department === 'STAMP' || product.department === 'TEXTILE'
          ? 'Stock deductions are booked automatically on release.'
          : undefined,
      confirmLabel: 'Release',
    })
    if (!confirmed) return
    try {
      await releaseToProduction.mutateAsync({ product, orderId: product.order_id, orderNumber })
    } catch (error) {
      // Lost the race against a concurrent release: the RPC rejected atomically.
      if (error instanceof InsufficientStockError) {
        showError('Not enough stock — the product was not released to production')
      } else {
        showError('Status could not be updated')
      }
    }
  }

  const markDone = async (): Promise<void> => {
    // Say so up front when this is the last open product: the order finishes with it.
    const finishesOrder =
      order != null &&
      deriveAutomaticOrderStatus(
        order,
        siblings.map(sibling => (sibling.id === product.id ? { ...sibling, status: 'DONE' } : sibling)),
      ) === 'FINISHED'
    const confirmed = await confirm({
      title: 'Mark product as done?',
      description: finishesOrder
        ? 'This is the last open product — the order will be marked as finished.'
        : undefined,
      confirmLabel: 'Mark done',
    })
    if (!confirmed) return
    try {
      await setProductStatus.mutateAsync({
        id: product.id,
        orderId: product.order_id,
        status: 'DONE',
        history: { event_type: 'MARKED_DONE' },
      })
    } catch {
      showError('Status could not be updated')
      return
    }
    try {
      await finishOrderWhenAllProductsDone(product.order_id)
    } catch {
      showError('Order could not be marked as finished')
    }
  }

  const advance = async (): Promise<void> => {
    if (product.status === 'IN_SETUP') return releaseToPrepress()
    if (product.status === 'PREPRESS') return releaseProductToProduction()
    if (product.status === 'IN_PRODUCTION') return markDone()
  }

  const forceRelease = async (reason: string): Promise<boolean> => {
    try {
      await forceReleaseMutation.mutateAsync({
        product,
        orderId: product.order_id,
        orderNumber,
        reason,
      })
      return true
    } catch {
      showError('Status could not be updated')
      return false
    }
  }

  return {
    target: available ? nextStatus : null,
    label: available ? label : null,
    pending,
    disabled,
    approvalBlocked,
    canForceRelease,
    advance,
    forceRelease,
  }
}
