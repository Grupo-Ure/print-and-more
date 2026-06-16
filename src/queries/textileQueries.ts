/**
 * Textile-specific query layer: the per-sub-order **designs drawer**
 * (textile_motifs) and the garment products' design **links**
 * (textile_motif_links). Garment products themselves go through the generic
 * productQueries; these cover the two textile satellites.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '../types/supabase'
import type { TextileMotifRow } from '../types/textile'
import { textileService } from '../services/textileService'
import { subOrderProductService } from '../services/subOrderProductService'
import { useProductsBySubOrderId } from './productQueries'

type MotifInsert = Database['public']['Tables']['textile_motifs']['Insert']
type MotifUpdate = Database['public']['Tables']['textile_motifs']['Update']

export const textileKeys = {
  motifs: (subOrderId: string) => ['textile', 'motifs', subOrderId] as const,
  links: (subOrderId: string) => ['textile', 'links', subOrderId] as const,
}

/** The sub-order's reusable designs drawer. */
export function useTextileMotifs(subOrderId: string | null) {
  return useQuery({
    queryKey: textileKeys.motifs(subOrderId ?? '__none__'),
    queryFn: () => textileService.getMotifsBySubOrder(subOrderId as string),
    enabled: !!subOrderId,
  })
}

/** Design links for every garment product in the sub-order (dependent on products). */
export function useTextileMotifLinksBySubOrderId(subOrderId: string | null) {
  const productsQuery = useProductsBySubOrderId(subOrderId)
  const productIds = (productsQuery.data ?? []).map(p => p.id)
  const linksQuery = useQuery({
    queryKey: textileKeys.links(subOrderId ?? '__none__'),
    queryFn: () => subOrderProductService.getMotifLinksByProductIds(productIds),
    enabled: !!subOrderId && productsQuery.isSuccess,
  })
  return { ...linksQuery, isError: linksQuery.isError || productsQuery.isError }
}

/** Create or update a design in the drawer; refresh the drawer. */
export function useSaveTextileMotif(subOrderId: string) {
  const queryClient = useQueryClient()
  return useMutation<TextileMotifRow, Error, { id?: string; payload: MotifInsert }>({
    mutationFn: ({ id, payload }) =>
      id ? textileService.updateMotif(id, payload as MotifUpdate) : textileService.createMotif(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: textileKeys.motifs(subOrderId) })
    },
  })
}

/** Delete a design; its links cascade in the DB, so refresh both. */
export function useDeleteTextileMotif(subOrderId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => textileService.deleteMotif(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: textileKeys.motifs(subOrderId) })
      void queryClient.invalidateQueries({ queryKey: textileKeys.links(subOrderId) })
    },
  })
}
