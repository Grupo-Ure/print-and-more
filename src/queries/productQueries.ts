import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { departmentProductService, type ProductFileAssignment } from '../services/departmentProductService'
import type { LoadedProduct, ProductWriteInput } from '../types/product'
import type { TextileMotifLinkInput } from '../types/textile'
import { isMeaningfulChange } from '../lib/status/meaningfulChange'
import { bounceBackIfCommitted } from './jobQueries'
import { textileKeys } from './textileQueries'

export const productKeys = {
  all: ['products'] as const,
  byJobId: (id: string) => ['products', 'by-job-id', id] as const,
  filesByJobId: (id: string) => ['products', 'files', 'by-job-id', id] as const,
}

/** Parent + typed child rows for a job, ordered by sort_order. */
export function useProductsByJobId(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? productKeys.byJobId(jobId) : productKeys.byJobId('__none__'),
    queryFn: () => departmentProductService.getProductsByJobId(jobId as string),
    enabled: !!jobId,
  })
}

/**
 * File assignments for every product in a job. Dependent on the products
 * query (mirrors `useOrdersList` → `useCustomerIdSearch`): it derives the product
 * ids from the products cache and only fires once that query has settled. Keyed
 * by `jobId`; the save/delete mutations keep this cache authoritative.
 */
export function useProductFilesByJobId(jobId: string | null) {
  const productsQuery = useProductsByJobId(jobId)
  const productIds = (productsQuery.data ?? []).map(p => p.id)

  const filesQuery = useQuery({
    queryKey: jobId ? productKeys.filesByJobId(jobId) : productKeys.filesByJobId('__none__'),
    queryFn: () => departmentProductService.getFilesByProductIds(productIds),
    enabled: !!jobId && productsQuery.isSuccess,
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
 * Job status is not touched here — status calculation is decoupled from
 * product edits (to be rebuilt; see STATUS_WORKFLOW_SPEC.md).
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()
  return useMutation<
    { products: LoadedProduct[]; files: ProductFileAssignment[] },
    Error,
    { input: ProductWriteInput; fileIds: string[]; jobId: string; links?: TextileMotifLinkInput[] }
  >({
    mutationFn: async ({ input, fileIds, jobId, links }) => {
      // 1. Product write (create or update).
      const productId = input.id ?? (await departmentProductService.createProduct(input))
      if (input.id) await departmentProductService.updateProduct(input.id, input)

      // 2. File-link diff against the product's current assignments.
      const existing = input.id ? await departmentProductService.getFilesByProductIds([input.id]) : []
      for (const assignment of existing) {
        if (!fileIds.includes(assignment.file_id)) {
          await departmentProductService.removeFileFromProduct(assignment.id)
        }
      }
      for (const fileId of fileIds) {
        if (!existing.some(a => a.file_id === fileId)) {
          await departmentProductService.assignFileToProduct(productId, fileId)
        }
      }

      // 2b. Textile design-link reconcile (only when the caller passes links).
      if (links) {
        const existingLinks = input.id ? await departmentProductService.getMotifLinksByProductIds([productId]) : []
        const keptIds = new Set(links.filter(l => l.id).map(l => l.id))
        for (const e of existingLinks) {
          if (!keptIds.has(e.id)) await departmentProductService.removeMotifLink(e.id)
        }
        for (const l of links) {
          const fields = { motif_id: l.motif_id, placement: l.placement, size: l.size, print_method: l.print_method }
          if (l.id) await departmentProductService.updateMotifLink(l.id, fields)
          else await departmentProductService.createMotifLink({ department_product_id: productId, ...fields })
        }
      }

      // 3. Reload authoritative state for the cache patch.
      const products = await departmentProductService.getProductsByJobId(jobId)
      const files = await departmentProductService.getFilesByProductIds(products.map(p => p.id))
      return { products, files }
    },
    onSuccess: ({ products, files }, { input, jobId, links }) => {
      // Read the pre-save child before overwriting the cache, to detect a meaningful edit.
      const prevChild = input.id
        ? (queryClient
            .getQueryData<LoadedProduct[]>(productKeys.byJobId(jobId))
            ?.find(p => p.id === input.id)?.child ?? null)
        : null

      queryClient.setQueryData(productKeys.byJobId(jobId), products)
      queryClient.setQueryData(productKeys.filesByJobId(jobId), files)
      if (links) void queryClient.invalidateQueries({ queryKey: textileKeys.links(jobId) })

      // Bounce-back: a meaningful content change drops a committed job to INCOMPLETE.
      const kind = input.id ? 'update' : 'create'
      if (
        isMeaningfulChange(
          input.department,
          kind,
          prevChild as Record<string, unknown> | null,
          input.child as unknown as Record<string, unknown>,
        )
      ) {
        void bounceBackIfCommitted(queryClient, jobId)
      }
    },
  })
}

/** Delete a product; patch the product + file caches by filtering (no reload). */
export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; jobId: string }>({
    mutationFn: ({ id }) => departmentProductService.deleteProduct(id),
    onSuccess: (_void, { id, jobId }) => {
      queryClient.setQueryData<LoadedProduct[]>(
        productKeys.byJobId(jobId),
        old => old?.filter(p => p.id !== id) ?? old,
      )
      queryClient.setQueryData<ProductFileAssignment[]>(
        productKeys.filesByJobId(jobId),
        old => old?.filter(a => a.department_product_id !== id) ?? old,
      )
      // Deleting a product is always a meaningful content change → bounce-back.
      void bounceBackIfCommitted(queryClient, jobId)
    },
  })
}
