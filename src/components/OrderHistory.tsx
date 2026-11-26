import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useOrderHistoryFeed, type OrderHistoryFilter } from '../queries/historyQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { useUsers } from '../queries/userQueries'
import { shortProductNumber } from '../lib/productShared'
import { HISTORY_EVENTS } from '../lib/historyEventLabels'
import { FilterBar } from './LogText'
import { HistoryEntryLine } from './HistoryEntryLine'
import { NextPageSentinel } from './NextPageSentinel'
import { DateRangeFilter } from './fields/DateRangeFilter'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { HistoryEventCombobox } from './fields/HistoryEventCombobox'
import { ProductCombobox } from './fields/ProductCombobox'
import { Button } from './ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.details.history
const FILTER_IDS = IDS.filters

const NO_FILTER: OrderHistoryFilter = { from: '', to: '', userId: null, productId: null, event: null }

/**
 * The order's history log — all of it, newest first, a page at a time as the
 * list is scrolled, one sentence per event — under a row of filters: a date
 * range, who did it, which product, which event. The filters apply in the
 * database, so they search every entry of the order. Rendered as the order's
 * History tab — mounted only while that tab is active, so the query runs on
 * demand (and the filters start empty each time).
 */
export function OrderHistory({
  orderId,
  onOpenProduct,
}: {
  orderId: string
  /** Shows the product on the order's Products tab; makes the product numbers links. */
  onOpenProduct?: (productId: string) => void
}) {
  const [filter, setFilter] = useState<OrderHistoryFilter>(NO_FILTER)
  const feed = useOrderHistoryFeed(orderId, filter)
  const productsQuery = useProductsByOrderId(orderId)
  const { data: users } = useUsers()

  const staffById = new Map((users ?? []).map(user => [user.id, user.name ?? user.id]))
  const products = productsQuery.data ?? []
  const entries = feed.data?.pages.flat() ?? []
  const isFiltered =
    filter.from !== '' || filter.to !== '' || filter.userId !== null || filter.productId !== null || filter.event !== null

  // "LFP-01" — the product number without the redundant order-number prefix
  // (every entry in this log belongs to the same order).
  const productShortNumber = (productId: string | null): string | null => {
    if (!productId) return null
    const number = products.find(product => product.id === productId)?.product_number
    return number ? shortProductNumber(number) : 'Product'
  }
  // The product to open from the entry, while the Products tab still lists it (not deleted, not cancelled).
  const existingProductId = (productId: string | null): string | null =>
    productId && products.some(product => product.id === productId && !product.is_cancelled) ? productId : null

  return (
    <section data-testid={IDS.root} aria-label="Order history" className="flex h-full flex-col gap-3">
      {/* Shown while a filter is set too: one that matches nothing must stay clearable. */}
      {(entries.length > 0 || isFiltered) && (
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
          <ProductCombobox
            products={products}
            value={filter.productId}
            onChange={productId => setFilter(prev => ({ ...prev, productId }))}
            testId={FILTER_IDS.product}
            emptyOptionTestId={FILTER_IDS.productAll}
            optionTestId={FILTER_IDS.productOption}
          />
          <HistoryEventCombobox
            options={HISTORY_EVENTS}
            value={filter.event}
            onChange={event => setFilter(prev => ({ ...prev, event }))}
            testId={FILTER_IDS.event}
            emptyOptionTestId={FILTER_IDS.eventAll}
            optionTestId={FILTER_IDS.eventOption}
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
      )}

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
                productLabel={productShortNumber(entry.product_id)}
                productId={existingProductId(entry.product_id)}
                staffById={staffById}
                onOpenProduct={onOpenProduct}
                testId={IDS.item}
              />
            ))}
          </ul>
        )}
        <NextPageSentinel
          hasNextPage={feed.hasNextPage}
          isFetchingNextPage={feed.isFetchingNextPage}
          fetchNextPage={feed.fetchNextPage}
        />
      </div>
    </section>
  )
}
