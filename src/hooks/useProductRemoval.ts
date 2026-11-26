import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { shortProductNumber } from '../lib/productShared'
import { useNewestApprovalRequest, useWithdrawApprovalRequest } from '../queries/approvalQueries'
import { useCancelProduct, useDeleteProduct } from '../queries/productQueries'
import type { LoadedProduct } from '../types/product'

export type ProductRemoval = {
  /** A product still in setup is deleted outright. */
  canDelete: boolean
  /** Past setup a product is cancelled instead (kept for history) — never once in production or done; a waiting product's request is withdrawn first. */
  canCancel: boolean
  pending: boolean
  /** Confirms with the user, then permanently deletes the product. */
  requestDelete: () => Promise<void>
  /** Confirms with the user, then cancels the product. */
  requestCancel: () => Promise<void>
}

/**
 * Removing a product from its order: delete while still in setup, cancel
 * afterwards. Shared by the product header buttons and the product list's
 * context menu so both apply the same rules. `product` may be null while the
 * detail view has nothing loaded; the actions are then no-ops.
 *
 * Either removal can leave an invoice order with only done products, in which
 * case the database finishes the order in the same write
 * (`fn_finish_order_if_done`).
 *
 * A product awaiting the customer's approval is cancelled like any other past
 * setup, but its open request is withdrawn first — the customer is told the
 * link no longer works, and no request is left open on a cancelled product.
 */
export function useProductRemoval(product: LoadedProduct | null): ProductRemoval {
  const cancelProduct = useCancelProduct()
  const deleteProduct = useDeleteProduct()
  const withdrawRequest = useWithdrawApprovalRequest()
  const newestRequest = useNewestApprovalRequest(product?.id ?? null)
  const confirm = useConfirm()
  const { showError } = useToast()

  const canDelete = product?.status === 'IN_SETUP'
  const canCancel =
    product != null &&
    !product.is_cancelled &&
    product.status !== 'IN_PRODUCTION' &&
    product.status !== 'DONE'

  const requestCancel = async (): Promise<void> => {
    if (!product) return
    // A waiting product always has its open round as the newest one.
    const openRequest =
      product.status === 'AWAITING_APPROVAL' && newestRequest?.status === 'PENDING' ? newestRequest : null
    const confirmed = await confirm({
      title: 'Cancel this product?',
      description: openRequest
        ? `${shortProductNumber(product.product_number)} — its approval request is withdrawn first${openRequest.mailed ? ', and the customer is mailed that the link no longer works' : ''}.`
        : shortProductNumber(product.product_number),
      confirmLabel: 'Cancel product',
      destructive: true,
    })
    if (!confirmed) return
    if (openRequest) {
      try {
        await withdrawRequest.mutateAsync({
          requestId: openRequest.id,
          orderId: product.order_id,
          productId: product.id,
        })
      } catch {
        showError('The approval request could not be withdrawn — the product was not cancelled')
        return
      }
    }
    try {
      await cancelProduct.mutateAsync({ id: product.id, orderId: product.order_id })
    } catch {
      showError('Product could not be cancelled')
    }
  }

  const requestDelete = async (): Promise<void> => {
    if (!product) return
    const confirmed = await confirm({
      title: 'Permanently delete this product?',
      description: shortProductNumber(product.product_number),
      confirmLabel: 'Delete product',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteProduct.mutateAsync({ id: product.id, orderId: product.order_id })
    } catch {
      showError('Product could not be deleted')
    }
  }

  return {
    canDelete,
    canCancel,
    pending: cancelProduct.isPending || deleteProduct.isPending || withdrawRequest.isPending,
    requestDelete,
    requestCancel,
  }
}
