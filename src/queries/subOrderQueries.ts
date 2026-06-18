import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { calculateOrderStatus } from '../lib/orderStatus'
import type { OrderDetailRow, SubOrderRow } from '../types/database'
import type { Database } from '../types/supabase'
import { orderKeys, patchOrderStatusInCache } from './orderQueries'

type SubOrderInsert = Database['public']['Tables']['department_orders']['Insert']
type SubOrderUpdate = Database['public']['Tables']['department_orders']['Update']

export const subOrderKeys = {
  all: ['subOrders'] as const,
  byOrderId: (orderId: string) => ['subOrders', 'by-order-id', orderId] as const,
}

export function useSubOrdersByOrderId(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? subOrderKeys.byOrderId(orderId) : subOrderKeys.byOrderId('__none__'),
    queryFn: () => subOrderService.getSubOrdersByOrderId(orderId as string),
    enabled: !!orderId,
  })
}

export function useCreateSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<SubOrderRow, Error, SubOrderInsert>({
    mutationFn: payload => subOrderService.createSubOrder(payload),
    onSuccess: async created => {
      const orderId = created.order_id

      // Construct the post-mutation sibling list ourselves; we don't depend on the cache
      // having been updated yet by an invalidate refetch.
      const cachedSiblings = queryClient.getQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId)) ?? []
      const postChange = [...cachedSiblings, created]
      queryClient.setQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId), postChange)

      // Cache-miss skip: the dialog flow always has the order cached. If a future caller
      // invokes this mutation without a warmed order cache, the recalc is silently skipped.
      const cachedOrder = queryClient.getQueryData<OrderDetailRow>(orderKeys.byId(orderId))
      if (cachedOrder) {
        const nextStatus = calculateOrderStatus(cachedOrder.status, postChange)
        if (nextStatus !== cachedOrder.status) {
          const updatedOrder = await orderService.setOrderStatus(orderId, nextStatus)
          queryClient.setQueryData(orderKeys.byId(orderId), updatedOrder)
          patchOrderStatusInCache(queryClient, orderId, updatedOrder.status)
        }
      }

      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/**
 * Optimistic sub-order field update. `orderId` is required so `onMutate` can
 * locate the cached sibling list and patch the row in place immediately (instant
 * UI); the snapshot is restored on error. Note: this persists the given fields
 * only — it does NOT recompute status (status calculation is decoupled; see
 * STATUS_WORKFLOW_SPEC.md). Status transitions live in ContextPanel.
 */
export function useUpdateSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<
    SubOrderRow,
    Error,
    { id: string; orderId: string; patch: SubOrderUpdate },
    { previous?: SubOrderRow[] }
  >({
    mutationFn: ({ id, patch }) => subOrderService.updateSubOrder(id, patch),
    onMutate: async ({ id, orderId, patch }) => {
      await queryClient.cancelQueries({ queryKey: subOrderKeys.byOrderId(orderId) })
      const previous = queryClient.getQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId))
      queryClient.setQueryData<SubOrderRow[]>(
        subOrderKeys.byOrderId(orderId),
        old => old?.map(row => (row.id === id ? ({ ...row, ...patch } as SubOrderRow) : row)) ?? old,
      )
      return { previous }
    },
    onError: (_err, { orderId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(subOrderKeys.byOrderId(orderId), context.previous)
      }
    },
    onSuccess: updated => {
      // Reconcile the optimistic row with the authoritative server row.
      queryClient.setQueryData<SubOrderRow[]>(
        subOrderKeys.byOrderId(updated.order_id),
        old => old?.map(row => (row.id === updated.id ? updated : row)) ?? old,
      )
    },
    onSettled: (_data, _err, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}
