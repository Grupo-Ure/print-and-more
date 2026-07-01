/**
 * Shared plumbing for the per-department product detail components: the Stage 4
 * query reads, the add/edit mode machine, delete, and unlock gating. Each
 * department detail composes this with its own type dropdown, forms, and table.
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
  | { kind: 'add' }
  | { kind: 'edit'; product: LoadedProduct }

export function useProductEditor(
  subOrder: SubOrderRow,
  subOrderStatus: OrderStatus,
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

  // Products are read-only once the sub-order is released to production or done.
  const isReadOnly = subOrderStatus === 'PRODUCTION_READY' || subOrderStatus === 'DONE'

  const openAdd = useCallback(() => setMode({ kind: 'add' }), [])
  const openEdit = useCallback((product: LoadedProduct) => setMode({ kind: 'edit', product }), [])
  const close = useCallback(() => setMode({ kind: 'idle' }), [])

  /** Called by a form after a successful save (closes the add/edit form). */
  const handleSaved = useCallback(() => {
    setMode({ kind: 'idle' })
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      deleteProduct.mutate(
        { id, subOrderId: subOrder.id },
        {
          onSuccess: () => {
            setMode(m => (m.kind === 'edit' && m.product.id === id ? { kind: 'idle' } : m))
          },
          onError: () => showError('Product could not be deleted'),
        },
      )
    },
    [deleteProduct, subOrder.id, showError],
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
    isReadOnly,
  }
}
