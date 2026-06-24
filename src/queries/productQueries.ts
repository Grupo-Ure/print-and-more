import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subOrderProductService, type ProductFileAssignment } from '../services/subOrderProductService'
import type { LoadedProduct, ProductWriteInput } from '../types/product'
import type { TextileMotifLinkInput } from '../types/textile'
import { isMeaningfulChange } from '../lib/status/meaningfulChange'
import { bounceBackIfCommitted } from './subOrderQueries'
import { textileKeys } from './textileQueries'

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
 * Sub-order status is not touched here — status calculation is decoupled from
 * product edits (to be rebuilt; see STATUS_WORKFLOW_SPEC.md).
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation<
    { products: LoadedProduct[]; files: ProductFileAssignment[] },
    Error,
    { input: ProductWriteInput; fileIds: string[]; subOrderId: string; links?: TextileMotifLinkInput[] }
  >({
    mutationFn: async ({ input, fileIds, subOrderId, links }) => {
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

      // 2b. Textile design-link reconcile (only when the caller passes links).
      if (links) {
        const existingLinks = input.id ? await subOrderProductService.getMotifLinksByProductIds([productId]) : []
        const keptIds = new Set(links.filter(l => l.id).map(l => l.id))
        for (const e of existingLinks) {
          if (!keptIds.has(e.id)) await subOrderProductService.removeMotifLink(e.id)
        }
        for (const l of links) {
          const fields = { motif_id: l.motif_id, placement: l.placement, size: l.size, print_method: l.print_method }
          if (l.id) await subOrderProductService.updateMotifLink(l.id, fields)
          else await subOrderProductService.createMotifLink({ department_product_id: productId, ...fields })
        }
      }

      // 3. Reload authoritative state for the cache patch.
      const products = await subOrderProductService.getProductsBySubOrderId(subOrderId)
      const files = await subOrderProductService.getFilesByProductIds(products.map(p => p.id))
      return { products, files }
    },
    onSuccess: ({ products, files }, { input, subOrderId, links }) => {
      // Read the pre-save child before overwriting the cache, to detect a meaningful edit.
      const prevChild = input.id
        ? (queryClient
            .getQueryData<LoadedProduct[]>(productKeys.bySubOrderId(subOrderId))
            ?.find(p => p.id === input.id)?.child ?? null)
        : null

      queryClient.setQueryData(productKeys.bySubOrderId(subOrderId), products)
      queryClient.setQueryData(productKeys.filesBySubOrderId(subOrderId), files)
      if (links) void queryClient.invalidateQueries({ queryKey: textileKeys.links(subOrderId) })

      // Bounce-back: a meaningful content change drops a committed sub-order to INCOMPLETE.
      const kind = input.id ? 'update' : 'create'
      if (
        isMeaningfulChange(
          input.department,
          kind,
          prevChild as Record<string, unknown> | null,
          input.child as unknown as Record<string, unknown>,
        )
      ) {
        void bounceBackIfCommitted(queryClient, subOrderId)
      }
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
      // Deleting a product is always a meaningful content change → bounce-back.
      void bounceBackIfCommitted(queryClient, subOrderId)
    },
  })
}
