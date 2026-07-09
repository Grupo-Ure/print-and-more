/**
 * Textile-specific query layer: the per-job **designs drawer**
 * (textile_motifs) and the garment products' design **links**
 * (textile_motif_links). Garment products themselves go through the generic
 * productQueries; these cover the two textile satellites.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '../types/supabase'
import type { TextileMotifRow } from '../types/textile'
import { textileService } from '../services/textileService'
import { departmentProductService } from '../services/departmentProductService'
import { bounceBackIfCommitted } from './jobQueries'
import { useProductsByJobId } from './productQueries'

type MotifInsert = Database['public']['Tables']['textile_motifs']['Insert']
type MotifUpdate = Database['public']['Tables']['textile_motifs']['Update']

export const textileKeys = {
  motifs: (jobId: string) => ['textile', 'motifs', jobId] as const,
  links: (jobId: string) => ['textile', 'links', jobId] as const,
}

/** The job's reusable designs drawer. */
export function useTextileMotifs(jobId: string | null) {
  return useQuery({
    queryKey: textileKeys.motifs(jobId ?? '__none__'),
    queryFn: () => textileService.getMotifsByJob(jobId as string),
    enabled: !!jobId,
  })
}

/** Design links for every garment product in the job (dependent on products). */
export function useTextileMotifLinksByJobId(jobId: string | null) {
  const productsQuery = useProductsByJobId(jobId)
  const productIds = (productsQuery.data ?? []).map(p => p.id)
  const linksQuery = useQuery({
    queryKey: textileKeys.links(jobId ?? '__none__'),
    queryFn: () => departmentProductService.getMotifLinksByProductIds(productIds),
    enabled: !!jobId && productsQuery.isSuccess,
  })
  return { ...linksQuery, isError: linksQuery.isError || productsQuery.isError }
}

/** Create or update a design in the drawer; refresh the drawer. */
export function useSaveTextileMotif(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation<TextileMotifRow, Error, { id?: string; payload: MotifInsert }>({
    mutationFn: ({ id, payload }) =>
      id ? textileService.updateMotif(id, payload as MotifUpdate) : textileService.createMotif(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: textileKeys.motifs(jobId) })
      // Textile = any content change is meaningful → bounce a committed job back.
      void bounceBackIfCommitted(queryClient, jobId)
    },
  })
}

/** Delete a design; its links cascade in the DB, so refresh both. */
export function useDeleteTextileMotif(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => textileService.deleteMotif(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: textileKeys.motifs(jobId) })
      void queryClient.invalidateQueries({ queryKey: textileKeys.links(jobId) })
      // Textile = any content change is meaningful → bounce a committed job back.
      void bounceBackIfCommitted(queryClient, jobId)
    },
  })
}
