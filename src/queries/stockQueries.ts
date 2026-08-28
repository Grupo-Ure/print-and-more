import { useQuery } from '@tanstack/react-query'
import { productionReleaseService } from '../services/productionReleaseService'
import type { JobRow } from '../types/database'

export const stockAvailabilityKeys = {
  root: ['stock-availability'] as const,
  byJobId: (id: string) => ['stock-availability', 'by-job-id', id] as const,
}

/**
 * Shortages that would block releasing the job to production (empty array =
 * releasable). Only meaningful — and only fetched — for STAMP/TEXTILE jobs in
 * pre-press; every other job resolves to no shortages. Product edits and
 * releases invalidate the root key.
 */
export function useStockAvailability(job: JobRow | null) {
  const enabled =
    !!job && job.status === 'PREPRESS' && (job.department === 'STAMP' || job.department === 'TEXTILE')
  return useQuery({
    queryKey: job ? stockAvailabilityKeys.byJobId(job.id) : stockAvailabilityKeys.byJobId('__none__'),
    queryFn: () => productionReleaseService.checkStockAvailability(job as JobRow),
    enabled,
  })
}
