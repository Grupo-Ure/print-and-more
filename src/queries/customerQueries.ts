import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerService, type CustomerRow } from '../services/customerService'
import { invalidateOrderListsIfCustomerReferenced } from './orderQueries'
import type { Database } from '../types/supabase'

type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export const customerKeys = {
  all: ['customer'] as const,
  byId: (id: string) => ['customer', 'by-id', id] as const,
  search: (query: string) => ['customer', 'search', query] as const,
}

export function useCustomerSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: customerKeys.search(trimmed),
    queryFn: () => customerService.searchCustomers(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  })
}

export function useCustomerById(id: string | null) {
  return useQuery({
    queryKey: id ? customerKeys.byId(id) : customerKeys.byId('__none__'),
    queryFn: () => customerService.getCustomerById(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export type UpsertCustomerPayload = CustomerUpdate & { id?: string | null }

export function useUpsertCustomer() {
  const queryClient = useQueryClient()
  return useMutation<CustomerRow, Error, UpsertCustomerPayload>({
    mutationFn: async ({ id, ...payload }) => {
      if (id) return customerService.updateCustomer(id, payload)
      return customerService.createCustomer(payload as Database['public']['Tables']['customers']['Insert'])
    },
    onSuccess: saved => {
      queryClient.setQueryData(customerKeys.byId(saved.id), saved)
      invalidateOrderListsIfCustomerReferenced(queryClient, saved.id)
      void queryClient.invalidateQueries({ queryKey: ['customer', 'search'] })
    },
  })
}
