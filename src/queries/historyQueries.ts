import { useQuery } from '@tanstack/react-query'
import { historyService } from '../services/historyService'

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
