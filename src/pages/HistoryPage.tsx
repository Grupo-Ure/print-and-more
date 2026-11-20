import { useEffect, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import type { HistoryEvent, HistoryFeedFilter, HistoryFeedRow } from '../services/historyService'
import { useHistoryFeed } from '../queries/historyQueries'
import { useIsAdmin, useUsers } from '../queries/userQueries'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useNavigation } from '../context/navigation.context'
import { HISTORY_EVENT_LABELS } from '../lib/historyEventLabels'
import { historyFileName, historyMeta, stockItemLabel } from '../lib/historySentences'
import { shortProductNumber } from '../lib/productShared'
import { Login } from '../components/Login'
import { AccessDenied } from '../components/AccessDenied'
import { FilterBar } from '../components/LogText'
import { HistoryEntryLine } from '../components/HistoryEntryLine'
import { DateRangeFilter } from '../components/fields/DateRangeFilter'
import { EmployeeCombobox } from '../components/fields/EmployeeCombobox'
import { HistoryEventCombobox } from '../components/fields/HistoryEventCombobox'
import { HistoryRecordCombobox } from '../components/fields/HistoryRecordCombobox'
import { Button } from '../components/ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.historyPage
const FILTER_IDS = IDS.filters

const NO_FILTER: HistoryFeedFilter = { from: '', to: '', userId: null, event: null, record: null }

/** Every event type, for the event filter: the page reads the whole history, not one order's. */
const ALL_EVENTS = Object.keys(HISTORY_EVENT_LABELS) as HistoryEvent[]

/**
 * The whole history, for admins: every entry, whatever it concerns — the
 * order entries every employee sees on the order's History tab, and the
 * customer entries and stock bookings that have no order to be shown on.
 * Newest first, a page at a time, narrowed in the database by date range,
 * person, event and record. The database is what limits the entries without
 * an order to admins; the gate here only spares an employee an empty page.
 */
export function HistoryPage() {
  const { session, loading } = useSupabaseSession()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()

  if (loading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description="The history of every record requires an admin account." />
  return <HistoryFeed />
}

function HistoryFeed() {
  const [filter, setFilter] = useState<HistoryFeedFilter>(NO_FILTER)
  const feed = useHistoryFeed(filter)
  const { data: users } = useUsers()
  const { navigate, setActiveOrder, openProductInOrders } = useNavigation()

  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))
  const entries = feed.data?.pages.flat() ?? []
  const isFiltered =
    filter.from !== '' || filter.to !== '' || filter.userId !== null || filter.event !== null || filter.record !== null

  const openOrder = (orderId: string) => {
    setActiveOrder(orderId)
    navigate('orders')
  }

  // The next page loads once the end of the list scrolls into view (the list's own scroll area clips it).
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      observed => {
        if (observed[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <main data-testid={IDS.root} aria-label="History" className="flex h-full flex-col gap-3 p-3">
      <FilterBar label="Filter the history">
        <DateRangeFilter
          from={filter.from}
          to={filter.to}
          onChange={range => setFilter(prev => ({ ...prev, ...range }))}
          testId={FILTER_IDS.dateRange}
          calendarTestId={FILTER_IDS.dateRangeCalendar}
        />
        <EmployeeCombobox
          value={filter.userId}
          onChange={user => setFilter(prev => ({ ...prev, userId: user?.id ?? null }))}
          emptyLabel="Everyone"
          testId={FILTER_IDS.user}
          emptyOptionTestId={FILTER_IDS.userAll}
          userOptionTestId={FILTER_IDS.userOption}
        />
        <HistoryEventCombobox
          options={ALL_EVENTS}
          value={filter.event}
          onChange={event => setFilter(prev => ({ ...prev, event }))}
          testId={FILTER_IDS.event}
          emptyOptionTestId={FILTER_IDS.eventAll}
          optionTestId={FILTER_IDS.eventOption}
        />
        <HistoryRecordCombobox
          value={filter.record}
          onChange={record => setFilter(prev => ({ ...prev, record }))}
          testId={FILTER_IDS.record}
          searchTestId={FILTER_IDS.recordSearch}
          emptyOptionTestId={FILTER_IDS.recordAll}
          optionTestId={FILTER_IDS.recordOption}
        />
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            data-testid={FILTER_IDS.clear}
            onClick={() => setFilter(NO_FILTER)}
          >
            <RotateCcw />
            Clear
          </Button>
        )}
      </FilterBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {feed.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {feed.isError && <p className="text-sm text-destructive">History could not be loaded</p>}
        {feed.isSuccess && entries.length === 0 && !isFiltered && (
          <p data-testid={IDS.empty} className="text-sm text-muted-foreground">No history entries yet</p>
        )}
        {feed.isSuccess && entries.length === 0 && isFiltered && (
          <p data-testid={IDS.noMatch} className="text-sm text-muted-foreground">No entries match the filters</p>
        )}
        {entries.length > 0 && (
          <ul data-testid={IDS.list} className="divide-y divide-border">
            {entries.map(entry => (
              <HistoryEntryLine
                key={entry.id}
                entry={entry}
                productLabel={entry.products ? shortProductNumber(entry.products.product_number) : null}
                productId={entry.products && !entry.products.is_cancelled ? entry.product_id : null}
                staffById={staffById}
                onOpenProduct={productId => entry.order_id && openProductInOrders(entry.order_id, productId)}
                record={<EntryRecord entry={entry} onOpenOrder={openOrder} />}
                testId={IDS.item}
              />
            ))}
          </ul>
        )}
        {isFetchingNextPage && <p className="py-1.5 text-sm text-muted-foreground">Loading…</p>}
        {hasNextPage && <div ref={setSentinel} aria-hidden className="h-px" />}
      </div>
    </main>
  )
}

/**
 * What an entry concerns, named the way the shop knows it: the order by its
 * number (a link that opens it), else the customer, the stock item or the file.
 * An entry about a product or a file of an order names the order — the
 * sentence names the product.
 */
function EntryRecord({ entry, onOpenOrder }: { entry: HistoryFeedRow; onOpenOrder: (orderId: string) => void }) {
  const orderId = entry.order_id
  if (orderId && entry.orders) {
    return (
      <button
        type="button"
        title="Open this order"
        data-testid={IDS.record}
        data-record-kind="order"
        className="cursor-pointer font-medium text-sky-600 hover:underline dark:text-sky-400"
        onClick={() => onOpenOrder(orderId)}
      >
        Order {entry.orders.order_number}
      </button>
    )
  }
  if (entry.customers) return <RecordText kind="customer">{entry.customers.name}</RecordText>
  if (entry.stamp_model_id || entry.textile_variant_id) return <RecordText kind="stockItem">{stockItemLabel(entry)}</RecordText>
  if (entry.file_id) {
    return <RecordText kind="file">{entry.files?.display_name ?? historyFileName(historyMeta(entry))}</RecordText>
  }
  return null
}

function RecordText({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <span data-testid={IDS.record} data-record-kind={kind} className="font-medium">
      {children}
    </span>
  )
}
