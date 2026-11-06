import { useQuery } from '@tanstack/react-query'
import { backupJobService } from '../services/backupJobService'

export const backupJobKeys = {
  all: ['backup-jobs'] as const,
}

/** Every backup ever made, newest first (Settings → Backups). */
export function useBackupJobs() {
  return useQuery({
    queryKey: backupJobKeys.all,
    queryFn: () => backupJobService.list(),
  })
}
