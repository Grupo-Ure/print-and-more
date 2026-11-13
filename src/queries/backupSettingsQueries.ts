import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  backupSettingsService,
  type BackupSettings,
  type BackupSettingsPatch,
} from '../services/backupSettingsService'

export const backupSettingsKeys = {
  all: ['backup-settings'] as const,
}

export function useBackupSettings() {
  return useQuery({
    queryKey: backupSettingsKeys.all,
    queryFn: () => backupSettingsService.get(),
    staleTime: 60_000,
  })
}

/**
 * Saves changed settings. Not optimistic: the field shows the stored value
 * once the database has taken it, as the approval settings do.
 */
export function useUpdateBackupSettings() {
  const queryClient = useQueryClient()
  return useMutation<BackupSettings, Error, BackupSettingsPatch>({
    mutationFn: patch => backupSettingsService.update(patch),
    onSuccess: saved => {
      queryClient.setQueryData<BackupSettings>(backupSettingsKeys.all, saved)
    },
  })
}
