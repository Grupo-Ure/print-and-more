/**
 * Shared plumbing for the per-department product detail components: the Stage 4
 * query reads, the add/edit mode machine, delete, unlock gating, and the
 * `onProductsChanged` status-cascade wiring. Each department detail composes this
 * with its own type dropdown, forms, and table.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useDeleteProduct,
  useProductFilesBySubOrderId,
  useProductsBySubOrderId,
} from '../../queries/productQueries'
import type { OrderStatus, SubOrderRow } from '../../types/database'
import type { LoadedProduct } from '../../types/product'
import type { ProductFileAssignment } from '../../services/subOrderProductService'
import { useToast } from '../Toast'

/** Which form (if any) the detail is showing. */
export type EditorMode =
  | { kind: 'idle' }
  | { kind: 'add'; type: string }
  | { kind: 'edit'; product: LoadedProduct }

export function useProductEditor(
  subOrder: SubOrderRow,
  subOrderStatus: OrderStatus,
  onProductsChanged?: (hasProducts: boolean) => void,
) {
  const { showError } = useToast()

  const productsQuery = useProductsBySubOrderId(subOrder.id)
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const productsLoading = productsQuery.isLoading

  const filesQuery = useProductFilesBySubOrderId(subOrder.id)
  const filesByProduct = useMemo(() => {
    const map: Record<string, ProductFileAssignment[]> = {}
    for (const row of filesQuery.data ?? []) {
      ;(map[row.department_product_id] ??= []).push(row)
    }
    return map
  }, [filesQuery.data])

  const deleteProduct = useDeleteProduct()

  const [mode, setMode] = useState<EditorMode>({ kind: 'idle' })
  const [unlocked, setUnlocked] = useState(false)

  const requiresUnlock =
    (subOrderStatus === 'PREPRESS_READY' || subOrderStatus === 'PRODUCTION_READY') && !unlocked

  const requestUnlock = useCallback(() => {
    if (window.confirm('Sub-order is already released.\nReally edit products?')) setUnlocked(true)
  }, [])

  const openAdd = useCallback((type: string) => setMode({ kind: 'add', type }), [])
  const openEdit = useCallback((product: LoadedProduct) => setMode({ kind: 'edit', product }), [])
  const close = useCallback(() => setMode({ kind: 'idle' }), [])

  /** Called by a form after a successful save (fresh product list from the mutation). */
  const handleSaved = useCallback(
    (saved: LoadedProduct[]) => {
      onProductsChanged?.(saved.length > 0)
      setMode({ kind: 'idle' })
    },
    [onProductsChanged],
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteProduct.mutate(
        { id, subOrderId: subOrder.id },
        {
          onSuccess: () => {
            onProductsChanged?.(products.filter(p => p.id !== id).length > 0)
            setMode(m => (m.kind === 'edit' && m.product.id === id ? { kind: 'idle' } : m))
          },
          onError: () => showError('Product could not be deleted'),
        },
      )
    },
    [deleteProduct, subOrder.id, products, onProductsChanged, showError],
  )

  /** File ids currently assigned to a product (for edit-prefill). */
  const fileIdsFor = useCallback(
    (productId: string) => (filesByProduct[productId] ?? []).map(a => a.file_id),
    [filesByProduct],
  )

  return {
    products,
    productsLoading,
    filesByProduct,
    mode,
    openAdd,
    openEdit,
    close,
    handleSaved,
    handleDelete,
    fileIdsFor,
    unlocked,
    requiresUnlock,
    requestUnlock,
  }
}
