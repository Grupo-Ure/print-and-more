import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { backupJobService } from '../services/backupJobService'

export const backupJobKeys = {
  all: ['backup-jobs'] as const,
  machine: (server: string | null, share: string | null, folder: string | null) =>
    ['backup-machine', server, share, folder] as const,
}

/** Every backup ever made, newest first (Settings → Backups); follows changes live. */
export function useBackupJobs() {
  const queryClient = useQueryClient()

  useEffect(() => {
    return backupJobService.subscribeToJobChanges(() => {
      void queryClient.invalidateQueries({ queryKey: backupJobKeys.all })
    })
  }, [queryClient])

  return useQuery({
    queryKey: backupJobKeys.all,
    queryFn: () => backupJobService.list(),
  })
}

/** What this machine is and whether it can reach the shop folder now; disabled outside the desktop app. */
export function useBackupMachine(share: { server: string | null; share: string | null; folder: string | null } | null) {
  const bridge = window.pam?.backups
  return useQuery({
    queryKey: backupJobKeys.machine(share?.server ?? null, share?.share ?? null, share?.folder ?? null),
    queryFn: async () => {
      const [identity, folder] = await Promise.all([bridge!.identity(), bridge!.probeFolder(share!)])
      return { machine: identity.machine, folder }
    },
    enabled: bridge !== undefined && share !== null,
    // The share can go away while the page is open; look again now and then.
    refetchInterval: 60_000,
  })
}
