import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { timeLogService, type TimeLogRow } from '../services/timeLogService'
import { historyKeys } from './historyQueries'

export const timeLogKeys = {
  all: ['timeLogs'] as const,
  byProductId: (productId: string) => ['timeLogs', 'byProduct', productId] as const,
  minutesByOrderId: (orderId: string) => ['timeLogs', 'minutesByOrder', orderId] as const,
}

export function useTimeLogsByProductId(productId: string | null) {
  return useQuery({
    queryKey: timeLogKeys.byProductId(productId ?? '__none__'),
    queryFn: () => timeLogService.getByProductId(productId!),
    enabled: productId != null,
  })
}

/** Total logged minutes per product (product id → minutes) — product-list and order-header displays. */
export function useTimeLogMinutesByOrderId(orderId: string | null) {
  return useQuery({
    queryKey: timeLogKeys.minutesByOrderId(orderId ?? '__none__'),
    queryFn: () => timeLogService.getMinutesByOrderId(orderId!),
    enabled: orderId != null,
  })
}

export function useCreateTimeLog() {
  const queryClient = useQueryClient()
  return useMutation<
    TimeLogRow,
    Error,
    { orderId: string; productId: string; minutes: number; user: { id: string; name: string } }
  >({
    mutationFn: params => timeLogService.create(params),
    onSuccess: (_row, { orderId, productId }) => {
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.byProductId(productId) })
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.minutesByOrderId(orderId) })
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}

/** Admin-only (enforced by RLS). */
export function useDeleteTimeLog() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { orderId: string; log: TimeLogRow }>({
    mutationFn: params => timeLogService.remove(params),
    onSuccess: (_void, { orderId, log }) => {
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.byProductId(log.product_id) })
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.minutesByOrderId(orderId) })
    },
    onSettled: (_void, _err, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}
