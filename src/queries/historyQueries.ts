import { useMutation } from '@tanstack/react-query'
import { historyService, type HistoryEvent } from '../services/historyService'

export type WriteHistoryPayload = {
  order_id: string
  job_id?: string
  event_type: HistoryEvent
  reason?: string
  meta?: Record<string, unknown>
}

export function useWriteHistory() {
  return useMutation<void, Error, WriteHistoryPayload>({
    mutationFn: payload => historyService.writeHistory(payload),
  })
}
