import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subOrderProductService, type ProductFileAssignment } from '../services/subOrderProductService'
import type { LoadedProduct, ProductWriteInput } from '../types/product'

export const productKeys = {
  all: ['products'] as const,
  bySubOrderId: (id: string) => ['products', 'by-sub-order-id', id] as const,
  filesBySubOrderId: (id: string) => ['products', 'files', 'by-sub-order-id', id] as const,
}

/** Parent + typed child rows for a sub-order, ordered by sort_order. */
export function useProductsBySubOrderId(subOrderId: string | null) {
  return useQuery({
    queryKey: subOrderId ? productKeys.bySubOrderId(subOrderId) : productKeys.bySubOrderId('__none__'),
    queryFn: () => subOrderProductService.getProductsBySubOrderId(subOrderId as string),
    enabled: !!subOrderId,
  })
}

/**
 * File assignments for every product in a sub-order. Dependent on the products
 * query (mirrors `useOrdersList` → `useCustomerIdSearch`): it derives the product
 * ids from the products cache and only fires once that query has settled. Keyed
 * by `subOrderId`; the save/delete mutations keep this cache authoritative.
 */
export function useProductFilesBySubOrderId(subOrderId: string | null) {
  const productsQuery = useProductsBySubOrderId(subOrderId)
  const productIds = (productsQuery.data ?? []).map(p => p.id)

  const filesQuery = useQuery({
    queryKey: subOrderId ? productKeys.filesBySubOrderId(subOrderId) : productKeys.filesBySubOrderId('__none__'),
    queryFn: () => subOrderProductService.getFilesByProductIds(productIds),
    enabled: !!subOrderId && productsQuery.isSuccess,
  })

  return {
    ...filesQuery,
    isError: filesQuery.isError || productsQuery.isError,
  }
}

/**
 * Create-or-update a product and reconcile its file links in one unit, then
 * reload authoritative product + file lists and patch both caches.
 *
 * The file reconcile is an add/remove diff (not the legacy remove-all-then-
 * re-add). `createProduct` only returns the new id, so we can't reconstruct the
 * row from the mutation return — hence the reload before the cache patch.
 *
 * Status recompute is intentionally NOT handled here; callers wire their
 * `onProductsChanged` recompute via the mutation's per-call `onSuccess` option.
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation<
    { products: LoadedProduct[]; files: ProductFileAssignment[] },
    Error,
    { input: ProductWriteInput; fileIds: string[]; subOrderId: string }
  >({
    mutationFn: async ({ input, fileIds, subOrderId }) => {
      // 1. Product write (create or update).
      const productId = input.id ?? (await subOrderProductService.createProduct(input))
      if (input.id) await subOrderProductService.updateProduct(input.id, input)

      // 2. File-link diff against the product's current assignments.
      const existing = input.id ? await subOrderProductService.getFilesByProductIds([input.id]) : []
      for (const assignment of existing) {
        if (!fileIds.includes(assignment.file_id)) {
          await subOrderProductService.removeFileFromProduct(assignment.id)
        }
      }
      for (const fileId of fileIds) {
        if (!existing.some(a => a.file_id === fileId)) {
          await subOrderProductService.assignFileToProduct(productId, fileId)
        }
      }

      // 3. Reload authoritative state for the cache patch.
      const products = await subOrderProductService.getProductsBySubOrderId(subOrderId)
      const files = await subOrderProductService.getFilesByProductIds(products.map(p => p.id))
      return { products, files }
    },
    onSuccess: ({ products, files }, { subOrderId }) => {
      queryClient.setQueryData(productKeys.bySubOrderId(subOrderId), products)
      queryClient.setQueryData(productKeys.filesBySubOrderId(subOrderId), files)
    },
  })
}

/** Delete a product; patch the product + file caches by filtering (no reload). */
export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; subOrderId: string }>({
    mutationFn: ({ id }) => subOrderProductService.deleteProduct(id),
    onSuccess: (_void, { id, subOrderId }) => {
      queryClient.setQueryData<LoadedProduct[]>(
        productKeys.bySubOrderId(subOrderId),
        old => old?.filter(p => p.id !== id) ?? old,
      )
      queryClient.setQueryData<ProductFileAssignment[]>(
        productKeys.filesBySubOrderId(subOrderId),
        old => old?.filter(a => a.department_product_id !== id) ?? old,
      )
    },
  })
}
