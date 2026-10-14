import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  emailSettingsService,
  type EmailSetting,
  type EmailSettingPatch,
} from '../services/emailSettingsService'

export const emailSettingsKeys = {
  all: ['email-settings'] as const,
}

export function useEmailSettings() {
  return useQuery({
    queryKey: emailSettingsKeys.all,
    queryFn: () => emailSettingsService.list(),
    staleTime: 60_000,
  })
}

/**
 * Saves one template's changed switches. Not optimistic: the row shows the
 * stored value once the database has taken it, so what the shop sees is what
 * the next queued mail will get.
 */
export function useUpdateEmailSetting() {
  const queryClient = useQueryClient()
  return useMutation<EmailSetting, Error, { template: string; patch: EmailSettingPatch }>({
    mutationFn: ({ template, patch }) => emailSettingsService.update(template, patch),
    onSuccess: saved => {
      queryClient.setQueryData<EmailSetting[]>(emailSettingsKeys.all, old =>
        (old ?? []).map(row => (row.template === saved.template ? saved : row)),
      )
    },
  })
}
