import { useQuery } from '@tanstack/react-query'
import { releaseNotesService } from '../services/releaseNotesService'

export const releaseNotesKeys = { all: ['releaseNotes'] as const }

export function useReleaseNotes() {
  return useQuery({
    queryKey: releaseNotesKeys.all,
    queryFn: releaseNotesService.listReleases,
    staleTime: 60 * 60 * 1000, // an hour — CI-published data, not live state, and it keeps
    // an office of shared-IP machines well under GitHub's unauthenticated 60 req/hour limit
  })
}
