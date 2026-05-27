import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subOrderService } from '../services/subOrderService'
import type { SubOrderRow } from '../types/database'
import type { Database } from '../types/supabase'
import { orderKeys } from './orderQueries'

type SubOrderInsert = Database['public']['Tables']['sub_orders']['Insert']
type SubOrderUpdate = Database['public']['Tables']['sub_orders']['Update']

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
    onSuccess: created => {
      const orderId = created.order_id
      void queryClient.invalidateQueries({ queryKey: subOrderKeys.byOrderId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}

export function useUpdateSubOrder() {
  const queryClient = useQueryClient()
  return useMutation<SubOrderRow, Error, { id: string; patch: SubOrderUpdate }>({
    mutationFn: ({ id, patch }) => subOrderService.updateSubOrder(id, patch),
    onSuccess: updated => {
      const orderId = updated.order_id
      queryClient.setQueryData<SubOrderRow[]>(
        subOrderKeys.byOrderId(orderId),
        old => old?.map(row => (row.id === updated.id ? updated : row)) ?? old,
      )
      void queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    },
  })
}
