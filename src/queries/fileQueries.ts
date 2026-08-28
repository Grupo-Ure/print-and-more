import { useQuery } from '@tanstack/react-query'
import { fileService } from '../services/fileService'

export const fileKeys = {
  all: ['files'] as const,
  byOrderId: (orderId: string) => ['files', 'by-order-id', orderId] as const,
}

export function useFilesByOrderId(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? fileKeys.byOrderId(orderId) : fileKeys.byOrderId('__none__'),
    queryFn: () => fileService.getFilesByOrderId(orderId as string),
    enabled: !!orderId,
  })
}
