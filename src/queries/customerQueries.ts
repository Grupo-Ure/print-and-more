import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CUSTOMER_PAGE_SIZE, customerService, type CustomerRow } from '../services/customerService'
import { invalidateOrderListsIfCustomerReferenced } from './orderQueries'
import type { Database } from '../types/supabase'

type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export const customerKeys = {
  all: ['customer'] as const,
  byId: (id: string) => ['customer', 'by-id', id] as const,
  list: (query: string) => ['customer', 'list', query] as const,
}

export function useInfiniteCustomers(query: string) {
  const trimmed = query.trim()
  return useInfiniteQuery({
    queryKey: customerKeys.list(trimmed),
    queryFn: ({ pageParam }) =>
      customerService.listCustomers({ query: trimmed, offset: pageParam, limit: CUSTOMER_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < CUSTOMER_PAGE_SIZE ? undefined : lastPageParam + CUSTOMER_PAGE_SIZE,
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
      void queryClient.invalidateQueries({ queryKey: ['customer', 'list'] })
    },
  })
}
