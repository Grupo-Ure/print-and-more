import { useMutation, useQuery } from '@tanstack/react-query'
import { historyService, type HistoryEvent } from '../services/historyService'

export type WriteHistoryPayload = {
  order_id: string
  job_id?: string
  event_type: HistoryEvent
  reason?: string
  meta?: Record<string, unknown>
}

export const historyKeys = {
  all: ['history'] as const,
  byOrderId: (orderId: string) => ['history', 'by-order-id', orderId] as const,
}

export function useHistoryForOrder(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? historyKeys.byOrderId(orderId) : historyKeys.byOrderId('__none__'),
    queryFn: () => historyService.getHistoryForOrder(orderId as string),
    enabled: !!orderId,
  })
}

export function useWriteHistory() {
  return useMutation<void, Error, WriteHistoryPayload>({
    mutationFn: payload => historyService.writeHistory(payload),
  })
}
