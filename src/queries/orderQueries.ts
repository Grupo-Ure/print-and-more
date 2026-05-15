import { useQuery, type QueryClient } from '@tanstack/react-query'
import { customerService } from '../services/customerService'
import { orderService, type OrderListEntry } from '../services/orderService'
import type { OrderStatus } from '../types/database'

export type OrdersListFilter = {
  searchDebounced: string
  statusAll: boolean
  selectedStatuses: OrderStatus[]
  deadlineFrom: string
  deadlineTo: string
  intakeFrom: string
  intakeTo: string
}

export const orderListKeys = {
  all: ['orders', 'list'] as const,
  customerIdSearch: (query: string) => ['customers', 'id-search', query] as const,
  list: (params: {
    is_archived: boolean | undefined
    customerIds: string[] | null
    statuses: OrderStatus[] | null
    deadlineFrom: string
    deadlineTo: string
    intakeFrom: string
    intakeTo: string
  }) => ['orders', 'list', params] as const,
}

// INVOICED orders live in the archived bucket; mixed selections need both, so is_archived becomes undefined.
function deriveIsArchived(filter: OrdersListFilter): boolean | undefined {
  if (filter.statusAll) return false
  const billedSelected = filter.selectedStatuses.includes('INVOICED')
  const otherSelected = filter.selectedStatuses.some(status => status !== 'INVOICED')
  if (billedSelected && otherSelected) return undefined
  if (billedSelected) return true
  return false
}

export function useCustomerIdSearch(query: string) {
  return useQuery({
    queryKey: orderListKeys.customerIdSearch(query),
    queryFn: () => customerService.searchCustomerIds(query),
    enabled: query.length > 0,
    staleTime: 30_000,
  })
}

export function useOrdersList(filter: OrdersListFilter) {
  const trimmedSearch = filter.searchDebounced.trim()
  const customerSearch = useCustomerIdSearch(trimmedSearch)

  const hasStatusFilter = filter.statusAll || filter.selectedStatuses.length > 0
  // Wait for customer-id resolution before firing the orders query when a search term is set.
  const searchSettled = !trimmedSearch || customerSearch.isSuccess
  const customerIds = trimmedSearch ? customerSearch.data ?? null : null

  return useQuery({
    queryKey: orderListKeys.list({
      is_archived: deriveIsArchived(filter),
      customerIds,
      statuses: !filter.statusAll ? filter.selectedStatuses : null,
      deadlineFrom: filter.deadlineFrom,
      deadlineTo: filter.deadlineTo,
      intakeFrom: filter.intakeFrom,
      intakeTo: filter.intakeTo,
    }),
    queryFn: async (): Promise<OrderListEntry[]> => {
      if (trimmedSearch && (customerIds === null || customerIds.length === 0)) return []
      return orderService.getOrdersForList({
        is_archived: deriveIsArchived(filter),
        customerIds: customerIds ?? undefined,
        statuses: !filter.statusAll ? filter.selectedStatuses : undefined,
        deadlineFrom: filter.deadlineFrom || undefined,
        deadlineTo: filter.deadlineTo || undefined,
        intakeFrom: filter.intakeFrom || undefined,
        intakeTo: filter.intakeTo || undefined,
      })
    },
    enabled: hasStatusFilter && searchSettled,
  })
}

/** Patch one order's status across every cached list (used by the in-place status update). */
export function patchOrderStatusInCache(
  queryClient: QueryClient,
  orderId: string,
  status: OrderStatus,
): void {
  queryClient.setQueriesData<OrderListEntry[]>(
    { queryKey: orderListKeys.all },
    old => old?.map(order => (order.id === orderId ? { ...order, status } : order)) ?? old,
  )
}

/** Refetch order lists only if the changed customer is referenced by a cached row. */
export function invalidateOrderListsIfCustomerReferenced(
  queryClient: QueryClient,
  customerId: string,
): void {
  const referenced = queryClient
    .getQueriesData<OrderListEntry[]>({ queryKey: orderListKeys.all })
    .some(([, data]) => data?.some(order => order.customer_id === customerId))
  if (referenced) {
    void queryClient.invalidateQueries({ queryKey: orderListKeys.all })
  }
}
