import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  HISTORY_PAGE_SIZE,
  historyService,
  type HistoryCursor,
  type HistoryFeedFilter,
  type HistoryFeedRow,
} from '../services/historyService'

export const historyKeys = {
  all: ['history'] as const,
  /** Everything read of one order's history; what a change to the order invalidates. */
  byOrderId: (orderId: string) => ['history', 'by-order-id', orderId] as const,
  orderFeed: (orderId: string, filter: OrderHistoryFilter) => ['history', 'by-order-id', orderId, filter] as const,
  feed: (filter: HistoryFeedFilter) => ['history', 'feed', filter] as const,
  recordSearch: (text: string) => ['history', 'record-search', text] as const,
}

/** The filters of an order's History tab: the feed's, with the order itself as the record. */
export type OrderHistoryFilter = Omit<HistoryFeedFilter, 'record'>

/** The cursor of the page after this one, or none once a page comes back short. */
function nextHistoryCursor(lastPage: HistoryFeedRow[]): HistoryCursor | undefined {
  const last = lastPage[lastPage.length - 1]
  return lastPage.length < HISTORY_PAGE_SIZE || !last ? undefined : { createdAt: last.created_at, id: last.id }
}

/** Every entry the caller may read (the History page), a page at a time, newest first. */
export function useHistoryFeed(filter: HistoryFeedFilter) {
  return useInfiniteQuery({
    queryKey: historyKeys.feed(filter),
    queryFn: ({ pageParam }) => historyService.listEntries(filter, pageParam),
    initialPageParam: null as HistoryCursor | null,
    getNextPageParam: nextHistoryCursor,
  })
}

/**
 * Every entry of one order (its History tab), a page at a time, newest first,
 * the filters applied in the database. Keyed under `historyKeys.byOrderId`, so
 * whatever refreshes the order's history refreshes this.
 */
export function useOrderHistoryFeed(orderId: string, filter: OrderHistoryFilter) {
  return useInfiniteQuery({
    queryKey: historyKeys.orderFeed(orderId, filter),
    queryFn: ({ pageParam }) =>
      // The label is how the History page names its pick; nothing shows this one.
      historyService.listEntries({ ...filter, record: { kind: 'order', id: orderId, label: '' } }, pageParam),
    initialPageParam: null as HistoryCursor | null,
    getNextPageParam: nextHistoryCursor,
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
