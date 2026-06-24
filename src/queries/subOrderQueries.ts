import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import { historyService, type HistoryEvent } from '../services/historyService'
import { deductProductionStock } from '../services/productionReleaseService'
import { calculateOrderStatus } from '../lib/orderStatus'
import { resolveEffectiveSubOrder } from '../lib/subOrderShared'
import type { OrderDetailRow, SubOrderRow, OrderStatus } from '../types/database'
import type { Database } from '../types/supabase'
import { orderKeys, patchOrderStatusInCache, useOrderById } from './orderQueries'

type SubOrderInsert = Database['public']['Tables']['department_orders']['Insert']
type SubOrderUpdate = Database['public']['Tables']['department_orders']['Update']

type HistoryParams = { event_type: HistoryEvent; reason?: string; meta?: Record<string, unknown> }

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

/**
 * Re-derive the order's aggregate status from the *cached* sub-order list and
 * persist it if it changed (the optimistic pattern that replaces the deprecated
 * `orderService.recalculateOrderStatus` DB round-trip). Always invalidates the
 * order lists so the sidebar reflects the change. Callers must patch the
 * sub-order cache *before* invoking this so the aggregation sees the new state.
 */
export async function reconcileOrderStatus(queryClient: QueryClient, orderId: string): Promise<void> {
  const order = queryClient.getQueryData<OrderDetailRow>(orderKeys.byId(orderId))
  const subOrders = queryClient.getQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId))
  if (order && subOrders) {
    const next = calculateOrderStatus(order.status, subOrders)
    if (next !== order.status) {
      const updated = await orderService.setOrderStatus(orderId, next)
      queryClient.setQueryData(orderKeys.byId(orderId), updated)
      patchOrderStatusInCache(queryClient, orderId, updated.status)
    }
  } else {
    void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
  }
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
}

function patchSubOrderInCache(queryClient: QueryClient, orderId: string, row: SubOrderRow): void {
  queryClient.setQueryData<SubOrderRow[]>(
    subOrderKeys.byOrderId(orderId),
    old => old?.map(r => (r.id === row.id ? row : r)) ?? old,
  )
}

/**
 * Persist a sub-order status directly (no hook), patching the sub-order cache and
 * reconciling the order. Used by the status helpers that run outside a component —
 * notably {@link bounceBackIfCommitted}.
 */
export async function persistSubOrderStatus(
  queryClient: QueryClient,
  id: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const row = await subOrderService.setSubOrderStatus(id, status)
  patchSubOrderInCache(queryClient, orderId, row)
  await reconcileOrderStatus(queryClient, orderId)
}

/** Locate a sub-order by id across the cached per-order lists (gives status + order_id). */
function findCachedSubOrder(queryClient: QueryClient, subOrderId: string): SubOrderRow | null {
  const entries = queryClient.getQueriesData<SubOrderRow[]>({ queryKey: subOrderKeys.all })
  for (const [, list] of entries) {
    const found = list?.find(s => s.id === subOrderId)
    if (found) return found
  }
  return null
}

/**
 * Bounce-back: if the sub-order is committed (PRODUCTION_READY / DONE), drop it to
 * INCOMPLETE. Called from the content mutations' `onSuccess` *only when the change was
 * meaningful* (see `isMeaningfulChange`). No-op for non-committed sub-orders, so the
 * caller doesn't need to know the current status.
 */
export async function bounceBackIfCommitted(queryClient: QueryClient, subOrderId: string): Promise<void> {
  const subOrder = findCachedSubOrder(queryClient, subOrderId)
  if (!subOrder) return
  if (subOrder.status !== 'PRODUCTION_READY' && subOrder.status !== 'DONE') return
  await persistSubOrderStatus(queryClient, subOrder.id, subOrder.order_id, 'INCOMPLETE')
}

/**
 * The raw active sub-order row, selected from the cached `useSubOrdersByOrderId` list
 * by id. Returns `null` until the list has loaded or if no match. This is the *raw*
 * row (inherited common fields still null) — use it when you need the override/inherit
 * state (e.g. SubOrderDetail's inheritance toggles). For the resolved fields use
 * {@link useEffectiveSubOrder}.
 */
export function useSubOrderById(orderId: string | null, subOrderId: string | null): SubOrderRow | null {
  const { data: subOrders } = useSubOrdersByOrderId(orderId)
  return subOrders?.find(s => s.id === subOrderId) ?? null
}

/**
 * The active sub-order with its inherited common fields resolved against the order
 * (see {@link resolveEffectiveSubOrder}). Composes {@link useSubOrderById} +
 * `useOrderById` from the cache; returns `null` until both have loaded. Use this
 * wherever completeness/validation needs the *effective* fields rather than the raw
 * (inheriting) columns.
 */
export function useEffectiveSubOrder(
  orderId: string | null,
  subOrderId: string | null,
): SubOrderRow | null {
  const subOrder = useSubOrderById(orderId, subOrderId)
  const { data: order } = useOrderById(orderId)
  // Memoize so the resolved row keeps a stable reference between renders (it only
  // changes when the sub-order or order data changes) — important for consumers that
  // use it as an effect dependency (the status manager).
  return useMemo(
    () => (subOrder && order ? resolveEffectiveSubOrder(subOrder, order) : null),
    [subOrder, order],
  )
}

export function useCreateSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<SubOrderRow, Error, SubOrderInsert>({
    mutationFn: payload => subOrderService.createSubOrder(payload),
    onSuccess: async created => {
      const orderId = created.order_id
      const cachedSiblings = queryClient.getQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId)) ?? []
      queryClient.setQueryData<SubOrderRow[]>(subOrderKeys.byOrderId(orderId), [...cachedSiblings, created])
      await reconcileOrderStatus(queryClient, orderId)
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

/** Manual status transition (prepress / production / done). Optionally writes a history entry. */
export function useSetSubOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation<
    SubOrderRow,
    Error,
    { id: string; orderId: string; status: OrderStatus; history?: HistoryParams }
  >({
    mutationFn: async ({ id, orderId, status, history }) => {
      const row = await subOrderService.setSubOrderStatus(id, status)
      if (history) await historyService.writeHistory({ order_id: orderId, sub_order_id: id, ...history })
      return row
    },
    onSuccess: async (row, { orderId }) => {
      patchSubOrderInCache(queryClient, orderId, row)
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/**
 * Release to production: book stock deductions (stamp/textile), set
 * PRODUCTION_READY, write the PRODUCTION_READY_SET history entry. The stock
 * deduction runs before the status write, matching the prior behaviour.
 */
export function useReleaseToProduction() {
  const queryClient = useQueryClient()
  return useMutation<SubOrderRow, Error, { subOrder: SubOrderRow; orderId: string; orderNumber: string | null }>({
    mutationFn: async ({ subOrder, orderId, orderNumber }) => {
      await deductProductionStock(subOrder, orderNumber)
      const row = await subOrderService.setSubOrderStatus(subOrder.id, 'PRODUCTION_READY')
      try {
        await historyService.writeHistory({
          order_id: orderId,
          sub_order_id: subOrder.id,
          event_type: 'PRODUCTION_READY_SET',
        })
      } catch {
        console.error('History production-released failed')
      }
      return row
    },
    onSuccess: async (row, { orderId }) => {
      patchSubOrderInCache(queryClient, orderId, row)
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/** Toggle the emergency flag + reason. Does not change status. */
export function useSetSubOrderEmergency() {
  const queryClient = useQueryClient()
  return useMutation<
    SubOrderRow,
    Error,
    {
      id: string
      orderId: string
      patch: Pick<SubOrderUpdate, 'is_emergency' | 'emergency_reason'>
      history?: HistoryParams
    }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await subOrderService.setSubOrderEmergency(id, patch)
      if (history) await historyService.writeHistory({ order_id: orderId, sub_order_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchSubOrderInCache(queryClient, orderId, row)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

/** Customer-approval requirement / grant. Does not change status. */
export function useSetCustomerApproval() {
  const queryClient = useQueryClient()
  return useMutation<
    SubOrderRow,
    Error,
    {
      id: string
      orderId: string
      patch: Pick<
        SubOrderUpdate,
        'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
      >
      history?: HistoryParams
    }
  >({
    mutationFn: async ({ id, orderId, patch, history }) => {
      const row = await subOrderService.setCustomerApproval(id, patch)
      if (history) await historyService.writeHistory({ order_id: orderId, sub_order_id: id, ...history })
      return row
    },
    onSuccess: (row, { orderId }) => {
      patchSubOrderInCache(queryClient, orderId, row)
    },
  })
}

/** Cancel a sub-order (excluded from order aggregation). */
export function useCancelSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: ({ id }) => subOrderService.cancelSubOrder(id),
    onSuccess: async (_void, { id, orderId }) => {
      queryClient.setQueryData<SubOrderRow[]>(
        subOrderKeys.byOrderId(orderId),
        old => old?.map(r => (r.id === id ? { ...r, is_cancelled: true } : r)) ?? old,
      )
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}

/** Permanently delete a sub-order (only while INCOMPLETE). */
export function useDeleteSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { id: string; orderId: string }>({
    mutationFn: ({ id }) => subOrderService.deleteSubOrder(id),
    onSuccess: async (_void, { id, orderId }) => {
      queryClient.setQueryData<SubOrderRow[]>(
        subOrderKeys.byOrderId(orderId),
        old => old?.filter(r => r.id !== id) ?? old,
      )
      await reconcileOrderStatus(queryClient, orderId)
    },
  })
}
