import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { customerService } from '../services/customerService'
import { orderService, type OrderListEntry } from '../services/orderService'
import { historyKeys } from './historyQueries'
import { productKeys } from './productQueries'
import type { Department, OrderDetailRow, OrderStatus } from '../types/database'
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
  /** Empty = every department. */
  departments: Department[]
  /** Off = non-archived orders plus billed ones; on = archived orders too. */
  showArchived: boolean
}

function matchesDepartmentFilter(order: OrderListEntry, filter: OrdersListFilter): boolean {
  const products = order.products ?? []
  return (
    filter.departments.length === 0 ||
    products.some(product => filter.departments.includes(product.department))
  )
}

export const orderKeys = {
  all: ['orders'] as const,
  lists: ['orders', 'list'] as const,
  customerIdSearch: (query: string) => ['customers', 'id-search', query] as const,
  list: (params: {
    includeArchived: boolean
    customerIds: string[] | null
    statuses: OrderStatus[] | null
    deadlineFrom: string
    deadlineTo: string
    intakeFrom: string
    intakeTo: string
  }) => ['orders', 'list', params] as const,
  byId: (id: string) => ['orders', 'by-id', id] as const,
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
      includeArchived: filter.showArchived,
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
        includeArchived: filter.showArchived,
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
    // The department is filtered over the cached rows (the products are already
    // loaded), so toggling it never triggers a refetch — hence not in the key.
    select:
      filter.departments.length === 0
        ? undefined
        : orders => orders.filter(order => matchesDepartmentFilter(order, filter)),
  })

  return {
    ...ordersQuery,
    isError: ordersQuery.isError || customerSearch.isError,
  }
}

/** Imperative on-demand fetch through the cache (e.g. opening the duplicate dialog). */
export function fetchOrderById(queryClient: QueryClient, orderId: string) {
  return queryClient.fetchQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: () => orderService.getOrderById(orderId),
  })
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
 * Keeps the orders view in step with the database — and the production
 * view's product panel, which shows the same order. While mounted it holds
 * a realtime subscription on `orders` and `products`. On every change,
 * the viewer's own included, it invalidates the order lists, plus the
 * changed order, its products and its history. The history entries are
 * written with the change, so the *History* tab stays in step with the
 * header. When the order is not known (a product deleted, a channel
 * replaced), it invalidates every order, product list and history.
 * Invalidation refetches only what is on screen; everything else is merely
 * marked stale.
 *
 * A refetch does not wipe a product form being edited: TanStack Form takes
 * new default values only while the form is untouched.
 */
export function useOrdersViewLiveRefresh(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    return orderService.subscribeToOrderChanges(orderId => {
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
        void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
        void queryClient.invalidateQueries({ queryKey: productKeys.byOrderId(orderId) })
        void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
      } else {
        void queryClient.invalidateQueries({ queryKey: orderKeys.all })
        void queryClient.invalidateQueries({ queryKey: productKeys.byOrderIdRoot })
        void queryClient.invalidateQueries({ queryKey: historyKeys.all })
      }
    })
  }, [queryClient])
}

/** Create a new order. The database records it (ORDER_CREATED). */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation<OrderDetailRow, Error, OrderInsert>({
    mutationFn: payload => orderService.createOrder(payload),
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

/** Save order header fields. The database records each changed field (SETTINGS_CHANGED). */
export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation<OrderDetailRow, Error, { id: string; patch: OrderUpdate }>({
    mutationFn: ({ id, patch }) => orderService.updateOrder(id, patch),
    onSuccess: updated => {
      queryClient.setQueryData(orderKeys.byId(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/**
 * Direct order-status set (start processing, mark finished, reopen). The
 * database records the step (PROCESSING_STARTED, ORDER_FINISHED,
 * ORDER_REOPENED).
 */
export function useSetOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation<OrderDetailRow, Error, { id: string; status: OrderStatus }>({
    mutationFn: ({ id, status }) => orderService.setOrderStatus(id, status),
    onSuccess: updated => {
      queryClient.setQueryData(orderKeys.byId(updated.id), updated)
      patchOrderStatusInCache(queryClient, updated.id, updated.status)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Soft-archive (hidden from list, status unchanged). The database records it (ORDER_ARCHIVED). */
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

/**
 * Cancel an order: every product cancelled and the order archived, in one
 * call to `cancel_order`, which records the cancel and what it caused under
 * one action.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => orderService.cancelOrder(id),
    onSuccess: (_void, { id }) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.byOrderId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(id) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/**
 * Terminal close (BILLED + archived). Invoice orders reach this from FINISHED
 * ("Mark as invoiced"); cash orders close directly from IN_PROGRESS ("Finish &
 * close") and skip FINISHED entirely. The database tells the two apart by the
 * status left and records ORDER_BILLED or ORDER_CLOSED_CASH.
 */
export function useMarkOrderBilled() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => orderService.markOrderBilled(id),
    onSuccess: (_void, { id }) => {
      patchOrderStatusInCache(queryClient, id, 'BILLED')
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
