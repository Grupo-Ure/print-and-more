import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { shortProductNumber } from '../lib/productShared'
import {
  useCancelProduct,
  useDeleteProduct,
  useFinishOrderWhenAllProductsDone,
} from '../queries/productQueries'
import type { LoadedProduct } from '../types/product'

export type ProductRemoval = {
  /** A product still in setup is deleted outright. */
  canDelete: boolean
  /** Past setup a product is cancelled instead (kept for history) — never once in production or done. */
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
 * Either removal can leave the order with only done products, in which case the
 * order finishes on its own (see `useFinishOrderWhenAllProductsDone`).
 */
export function useProductRemoval(product: LoadedProduct | null): ProductRemoval {
  const cancelProduct = useCancelProduct()
  const deleteProduct = useDeleteProduct()
  const finishOrderWhenAllProductsDone = useFinishOrderWhenAllProductsDone()
  const confirm = useConfirm()
  const { showError } = useToast()

  const finishOrderIfComplete = async (orderId: string): Promise<void> => {
    try {
      await finishOrderWhenAllProductsDone(orderId)
    } catch {
      showError('Order could not be marked as finished')
    }
  }

  const canDelete = product?.status === 'IN_SETUP'
  const canCancel =
    product != null &&
    !product.is_cancelled &&
    product.status !== 'IN_PRODUCTION' &&
    product.status !== 'DONE'

  const requestCancel = async (): Promise<void> => {
    if (!product) return
    const confirmed = await confirm({
      title: 'Cancel this product?',
      description: shortProductNumber(product.product_number),
      confirmLabel: 'Cancel product',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await cancelProduct.mutateAsync({ id: product.id, orderId: product.order_id })
    } catch {
      showError('Product could not be cancelled')
      return
    }
    await finishOrderIfComplete(product.order_id)
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
      return
    }
    await finishOrderIfComplete(product.order_id)
  }

  return {
    canDelete,
    canCancel,
    pending: cancelProduct.isPending || deleteProduct.isPending,
    requestDelete,
    requestCancel,
  }
}
