import { useQuery } from '@tanstack/react-query'
import { emailService } from '../services/emailService'

/**
 * The queue drains every ten seconds without the app doing anything, so the
 * Emails tab re-reads at the same pace while it is open.
 */
const DRAIN_INTERVAL_MS = 10_000

export const emailKeys = {
  all: ['emails'] as const,
  queuedByOrderId: (orderId: string) => ['emails', 'queued', orderId] as const,
  sentByOrderId: (orderId: string) => ['emails', 'sent', orderId] as const,
  failedByOrderId: (orderId: string) => ['emails', 'failed', orderId] as const,
}

export function useQueuedEmails(orderId: string) {
  return useQuery({
    queryKey: emailKeys.queuedByOrderId(orderId),
    queryFn: () => emailService.listQueued(orderId),
    refetchInterval: DRAIN_INTERVAL_MS,
  })
}

export function useSentEmails(orderId: string) {
  return useQuery({
    queryKey: emailKeys.sentByOrderId(orderId),
    queryFn: () => emailService.listSent(orderId),
    refetchInterval: DRAIN_INTERVAL_MS,
  })
}

export function useFailedEmails(orderId: string) {
  return useQuery({
    queryKey: emailKeys.failedByOrderId(orderId),
    queryFn: () => emailService.listFailed(orderId),
    refetchInterval: DRAIN_INTERVAL_MS,
  })
}
