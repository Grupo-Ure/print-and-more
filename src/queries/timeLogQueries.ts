import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { timeLogService, type TimeLogRow } from '../services/timeLogService'
import { historyKeys } from './historyQueries'

export const timeLogKeys = {
  all: ['timeLogs'] as const,
  byJobId: (jobId: string) => ['timeLogs', 'byJob', jobId] as const,
  minutesByOrderId: (orderId: string) => ['timeLogs', 'minutesByOrder', orderId] as const,
}

export function useTimeLogsByJobId(jobId: string | null) {
  return useQuery({
    queryKey: timeLogKeys.byJobId(jobId ?? '__none__'),
    queryFn: () => timeLogService.getByJobId(jobId!),
    enabled: jobId != null,
  })
}

/** Total logged minutes per job (job id → minutes) — job-list and order-header displays. */
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
    { orderId: string; jobId: string; minutes: number; user: { id: string; name: string } }
  >({
    mutationFn: params => timeLogService.create(params),
    onSuccess: (_row, { orderId, jobId }) => {
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.byJobId(jobId) })
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
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.byJobId(log.job_id) })
      void queryClient.invalidateQueries({ queryKey: timeLogKeys.minutesByOrderId(orderId) })
    },
    onSettled: (_void, _err, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: historyKeys.byOrderId(orderId) })
    },
  })
}
