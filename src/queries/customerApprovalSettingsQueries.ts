import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  customerApprovalSettingsService,
  type CustomerApprovalSettings,
  type CustomerApprovalSettingsPatch,
} from '../services/customerApprovalSettingsService'

export const customerApprovalSettingsKeys = {
  all: ['customer-approval-settings'] as const,
}

export function useCustomerApprovalSettings() {
  return useQuery({
    queryKey: customerApprovalSettingsKeys.all,
    queryFn: () => customerApprovalSettingsService.get(),
    staleTime: 60_000,
  })
}

/**
 * Saves changed settings. Not optimistic: the field shows the stored value
 * once the database has taken it, as the email settings do.
 */
export function useUpdateCustomerApprovalSettings() {
  const queryClient = useQueryClient()
  return useMutation<CustomerApprovalSettings, Error, CustomerApprovalSettingsPatch>({
    mutationFn: patch => customerApprovalSettingsService.update(patch),
    onSuccess: saved => {
      queryClient.setQueryData<CustomerApprovalSettings>(customerApprovalSettingsKeys.all, saved)
    },
  })
}
