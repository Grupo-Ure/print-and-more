/**
 * Shared plumbing for the per-department product detail components: the Stage 4
 * query reads, the add/edit mode machine, delete, and unlock gating. Each
 * department detail composes this with its own type dropdown, forms, and table.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useDeleteProduct,
  useProductFilesByJobId,
  useProductsByJobId,
} from '../../queries/productQueries'
import type { JobStatus, JobRow } from '../../types/database'
import type { LoadedProduct } from '../../types/product'
import type { ProductFileAssignment } from '../../services/departmentProductService'
import { useOrderSelection } from '../../hooks/useOrderSelection'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmDialog'

/** Which form (if any) the detail is showing. */
export type EditorMode =
  | { kind: 'idle' }
  | { kind: 'add' }
  | { kind: 'edit'; product: LoadedProduct }
  | { kind: 'view'; product: LoadedProduct }

export function useProductEditor(
  job: JobRow,
  jobStatus: JobStatus,
) {
  const { showError } = useToast()
  const confirm = useConfirm()

  const productsQuery = useProductsByJobId(job.id)
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const productsLoading = productsQuery.isLoading

  const filesQuery = useProductFilesByJobId(job.id)
  const filesByProduct = useMemo(() => {
    const map: Record<string, ProductFileAssignment[]> = {}
    for (const row of filesQuery.data ?? []) {
      ;(map[row.department_product_id] ??= []).push(row)
    }
    return map
  }, [filesQuery.data])

  const deleteProduct = useDeleteProduct()

  // Products are read-only once the job is released to production or done.
  const isReadOnly = jobStatus === 'IN_PRODUCTION' || jobStatus === 'DONE'

  // A freshly created job is selected with a one-shot request to start in
  // "add" mode (see AddJobButtons). The department sections are keyed by job
  // id, so this initialiser runs once per job; the request is cleared right
  // after so re-selecting the job later opens the editor idle as usual.
  const { pendingProductAddJobId, clearPendingProductAdd } = useOrderSelection()
  const startInAdd = pendingProductAddJobId === job.id && !isReadOnly
  const [mode, setMode] = useState<EditorMode>(() => (startInAdd ? { kind: 'add' } : { kind: 'idle' }))
  useEffect(() => {
    if (pendingProductAddJobId === job.id) clearPendingProductAdd()
  }, [pendingProductAddJobId, job.id, clearPendingProductAdd])

  const openAdd = useCallback(() => setMode({ kind: 'add' }), [])
  const openEdit = useCallback((product: LoadedProduct) => setMode({ kind: 'edit', product }), [])
  const openView = useCallback((product: LoadedProduct) => setMode({ kind: 'view', product }), [])
  const close = useCallback(() => setMode({ kind: 'idle' }), [])

  /** Called by a form after a successful save (closes the add/edit form). */
  const handleSaved = useCallback(() => {
    setMode({ kind: 'idle' })
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await confirm({
        title: 'Delete this product?',
        description: 'The product and its file assignments will be removed.',
        confirmLabel: 'Delete product',
        destructive: true,
      })
      if (!confirmed) return
      deleteProduct.mutate(
        { id, jobId: job.id, orderId: job.order_id },
        {
          onSuccess: () => {
            setMode(m => (m.kind === 'edit' && m.product.id === id ? { kind: 'idle' } : m))
          },
          onError: () => showError('Product could not be deleted'),
        },
      )
    },
    [confirm, deleteProduct, job.id, job.order_id, showError],
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
    openView,
    close,
    handleSaved,
    handleDelete,
    fileIdsFor,
    isReadOnly,
  }
}
