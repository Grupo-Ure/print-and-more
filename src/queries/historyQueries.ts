import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  HISTORY_PAGE_SIZE,
  historyService,
  type HistoryCursor,
  type HistoryFeedFilter,
} from '../services/historyService'

export const historyKeys = {
  all: ['history'] as const,
  byOrderId: (orderId: string) => ['history', 'by-order-id', orderId] as const,
  feed: (filter: HistoryFeedFilter) => ['history', 'feed', filter] as const,
  recordSearch: (text: string) => ['history', 'record-search', text] as const,
}

/** Every entry the caller may read (the History page), a page at a time, newest first. */
export function useHistoryFeed(filter: HistoryFeedFilter) {
  return useInfiniteQuery({
    queryKey: historyKeys.feed(filter),
    queryFn: ({ pageParam }) => historyService.listEntries(filter, pageParam),
    initialPageParam: null as HistoryCursor | null,
    getNextPageParam: lastPage => {
      const last = lastPage[lastPage.length - 1]
      return lastPage.length < HISTORY_PAGE_SIZE || !last ? undefined : { createdAt: last.created_at, id: last.id }
    },
  })
}

/** The records matching a search, for narrowing the History page to one. */
export function useHistoryRecordSearch(text: string) {
  const trimmed = text.trim()
  return useQuery({
    queryKey: historyKeys.recordSearch(trimmed),
    queryFn: () => historyService.searchRecords(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  })
}

export function useHistoryForOrder(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? historyKeys.byOrderId(orderId) : historyKeys.byOrderId('__none__'),
    queryFn: () => historyService.getHistoryForOrder(orderId as string),
    enabled: !!orderId,
  })
}
