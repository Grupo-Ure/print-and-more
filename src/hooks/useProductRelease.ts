import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { WORKFLOW_STATUSES } from '../lib/statusLabels'
import { areAllProductsDone, isReadyForPrepress } from '../lib/productShared'
import {
  useForceReleaseToProduction,
  useProductsByOrderId,
  useReleaseToProduction,
  useSetProductStatus,
} from '../queries/productQueries'
import { useApprovalRequests } from '../queries/approvalQueries'
import { useOrderById } from '../queries/orderQueries'
import { useStockAvailability } from '../queries/stockQueries'
import { useIsAdmin } from '../queries/userQueries'
import { InsufficientStockError } from '../services/productionReleaseService'
import type { LoadedProduct } from '../types/product'
import type { ProductStatus } from '../types/database'

/**
 * Label of the action that advances a product out of the given status. Setup
 * has none: a product enters pre-press on its own, once the database finds it
 * ready (`fn_product_ready_for_prepress`).
 */
const ADVANCE_LABELS: Partial<Record<ProductStatus, string>> = {
  PREPRESS: 'Release to Production',
  IN_PRODUCTION: 'Mark product as done',
}

export type ProductRelease = {
  /** Status the advance moves to; null when there is none (setup, DONE) or the order is still a quote. */
  target: ProductStatus | null
  /** Label of the advance action; null exactly when `target` is. */
  label: string | null
  pending: boolean
  /** True while the advance is blocked by a gate or a mutation is in flight. */
  disabled: boolean
  /** Admins may bypass the pre-press condition, stock and approval-round gates while one of them is failing. */
  canForceRelease: boolean
  /** Confirms with the user, then advances the product one workflow step. */
  advance: () => Promise<void>
  /** Admin override past the pre-press condition, stock and approval-round gates; resolves true on success. */
  forceRelease: (reason: string) => Promise<boolean>
}

/**
 * The single forward action of a product's workflow — PREPRESS →
 * IN_PRODUCTION → DONE — with its gates (the newest customer approval round,
 * stock) and confirmations. Setup → pre-press is not an action: the database
 * makes it when the product is ready, and a product held in setup offers
 * admins the force release only. Shared by the release button in
 * the product header and the product list's context menu so both enforce the
 * same rules. The release to production's gates are the database's
 * (`release_to_production`); they are mirrored here so the buttons never
 * offer a release it would refuse. A product awaiting approval has no
 * advance at all — the request closing is its only way out.
 */
export function useProductRelease(product: LoadedProduct): ProductRelease {
  const setProductStatus = useSetProductStatus()
  const releaseToProduction = useReleaseToProduction()
  const forceReleaseMutation = useForceReleaseToProduction()
  const { showError } = useToast()
  const confirm = useConfirm()
  const { isAdmin } = useIsAdmin()
  const orderQuery = useOrderById(product.order_id)
  const { data: siblings = [] } = useProductsByOrderId(product.order_id)
  const { data: shortages = [] } = useStockAvailability(product)
  const approvalRequests = useApprovalRequests(product.id)

  const order = orderQuery.data
  const orderIsQuote = order?.status === 'QUOTE'
  const stockBlocked = shortages.length > 0
  // A product in setup is held there by the pre-press condition; once it holds,
  // the database promotes it. Nothing advances while the order is a quote.
  const heldInSetup =
    product.status === 'IN_SETUP' && order != null && !orderIsQuote && !isReadyForPrepress(product, order, order.customers)

  // The next status on the workflow track — none once the product is DONE, and
  // no label (so no advance) for setup. Nothing advances while the order is
  // still a quote.
  const nextIndex = WORKFLOW_STATUSES.indexOf(product.status) + 1
  const nextStatus: ProductStatus | null =
    nextIndex < WORKFLOW_STATUSES.length ? WORKFLOW_STATUSES[nextIndex] : null
  const label = ADVANCE_LABELS[product.status] ?? null
  const available = nextStatus != null && label != null && !orderIsQuote

  const pending =
    setProductStatus.isPending || releaseToProduction.isPending || forceReleaseMutation.isPending

  // The newest round decides: once the customer has been asked, only an
  // approved round releases — changes requested, expired or withdrawn block,
  // and an older approval does not count for a reworked proof. A product never
  // asked has no round. Until the rounds have loaded nothing is offered.
  const newestRequest = approvalRequests.data?.[0] ?? null
  const approvalBlocked =
    product.status === 'PREPRESS' &&
    (approvalRequests.isPending || (newestRequest != null && newestRequest.status !== 'APPROVED'))

  const disabled = pending || (product.status === 'PREPRESS' && (approvalBlocked || stockBlocked))

  // The override is offered only while a gate it can bypass is actually
  // failing; once the product validates the normal release covers it.
  const canForceRelease =
    isAdmin &&
    (heldInSetup ||
      (product.status === 'PREPRESS' && (stockBlocked || (approvalBlocked && !approvalRequests.isPending))))

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
      await releaseToProduction.mutateAsync({ productId: product.id, orderId: product.order_id })
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
    // Say so up front when this is the last open product of an invoice order:
    // the database finishes the order with it (fn_finish_order_if_done).
    const finishesOrder =
      order != null &&
      order.status === 'IN_PROGRESS' &&
      order.payment_method === 'INVOICE' &&
      areAllProductsDone(
        siblings.map(sibling => (sibling.id === product.id ? { ...sibling, status: 'DONE' as const } : sibling)),
      )
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
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  const advance = async (): Promise<void> => {
    if (product.status === 'PREPRESS') return releaseProductToProduction()
    if (product.status === 'IN_PRODUCTION') return markDone()
  }

  const forceRelease = async (reason: string): Promise<boolean> => {
    try {
      await forceReleaseMutation.mutateAsync({ productId: product.id, orderId: product.order_id, reason })
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
    canForceRelease,
    advance,
    forceRelease,
  }
}
