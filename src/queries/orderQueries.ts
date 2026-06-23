import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { customerService } from '../services/customerService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { orderService, type OrderListEntry } from '../services/orderService'
import type { Auftrag, OrderStatus } from '../types/database'
import type { Database } from '../types/supabase'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderUpdate = Database['public']['Tables']['orders']['Update']

export type OrdersListFilter = {
  searchDebounced: string
  statusAll: boolean
  selectedStatuses: OrderStatus[]
  deadlineFrom: string
  deadlineTo: string
  intakeFrom: string
  intakeTo: string
}

export const orderKeys = {
  all: ['orders'] as const,
  lists: ['orders', 'list'] as const,
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
  byId: (id: string) => ['orders', 'by-id', id] as const,
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
    queryKey: orderKeys.customerIdSearch(query),
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

  const ordersQuery = useQuery({
    queryKey: orderKeys.list({
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
    refetchOnWindowFocus: false,
  })

  return {
    ...ordersQuery,
    isError: ordersQuery.isError || customerSearch.isError,
  }
}

/** Patch one order's status across every cached list (used by the in-place status update). */
export function patchOrderStatusInCache(
  queryClient: QueryClient,
  orderId: string,
  status: OrderStatus,
): void {
  queryClient.setQueriesData<OrderListEntry[]>(
    { queryKey: orderKeys.lists },
    old => old?.map(order => (order.id === orderId ? { ...order, status } : order)) ?? old,
  )
}

/** Refetch order lists only if the changed customer is referenced by a cached row. */
export function invalidateOrderListsIfCustomerReferenced(
  queryClient: QueryClient,
  customerId: string,
): void {
  const referenced = queryClient
    .getQueriesData<OrderListEntry[]>({ queryKey: orderKeys.lists })
    .some(([, data]) => data?.some(order => order.customer_id === customerId))
  if (referenced) {
    void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
  }
}

/**
 * Create a new order. Writes an ORDER_CREATED history entry as a best-effort
 * follow-up — a failure there does not invalidate the order itself.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation<Auftrag, Error, OrderInsert>({
    mutationFn: async payload => {
      const order = await orderService.createOrder(payload)
      try {
        await historyService.writeHistory({ order_id: order.id, event_type: 'ORDER_CREATED' })
      } catch (err) {
        console.error('History ORDER_CREATED failed', err)
      }
      return order
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

export function useOrderById(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? orderKeys.byId(orderId) : orderKeys.byId('__none__'),
    queryFn: () => orderService.getOrderById(orderId as string),
    enabled: !!orderId,
  })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation<Auftrag, Error, { id: string; patch: OrderUpdate }>({
    mutationFn: ({ id, patch }) => orderService.updateOrder(id, patch),
    onSuccess: updated => {
      queryClient.setQueryData(orderKeys.byId(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

type OrderHistoryParams = { event_type: HistoryEvent; reason?: string; meta?: Record<string, unknown> }

/** Direct order-status set (e.g. start-processing QUOTE → INCOMPLETE). Optionally writes history. */
export function useSetOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation<Auftrag, Error, { id: string; status: OrderStatus; history?: OrderHistoryParams }>({
    mutationFn: async ({ id, status, history }) => {
      const updated = await orderService.setOrderStatus(id, status)
      if (history) await historyService.writeHistory({ order_id: id, ...history })
      return updated
    },
    onSuccess: updated => {
      queryClient.setQueryData(orderKeys.byId(updated.id), updated)
      patchOrderStatusInCache(queryClient, updated.id, updated.status)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Soft-archive (hidden from list, status unchanged). */
export function useArchiveOrder() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => orderService.archiveOrder(id),
    onSuccess: (_void, { id }) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Cancel order: cancel all sub-orders + archive. Writes a CANCELLED history entry. */
export function useArchiveOrderWithCancelledSubOrders() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await orderService.archiveOrderWithCancelledSubOrders(id)
      await historyService.writeHistory({ order_id: id, event_type: 'CANCELLED' })
    },
    onSuccess: (_void, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['subOrders', 'by-order-id', id] })
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Mark invoiced (INVOICED + archived). Writes a MARKED_DONE history entry. */
export function useMarkOrderBilled() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await orderService.markOrderBilled(id)
      await historyService.writeHistory({
        order_id: id,
        event_type: 'MARKED_DONE',
        meta: { abgerechnet_auftrag: true },
      })
    },
    onSuccess: (_void, { id }) => {
      patchOrderStatusInCache(queryClient, id, 'INVOICED')
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Permanently delete an order. */
export function useDeleteOrder() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => orderService.deleteOrder(id),
    onSuccess: (_void, { id }) => {
      queryClient.removeQueries({ queryKey: orderKeys.byId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}
