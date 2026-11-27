import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import type { Database } from '../../src/types/supabase'
import { BasePOM } from './BasePOM'

type HistoryEvent = Database['public']['Enums']['history_event']

const IDS = TEST_IDS.orders.details.history

/** The order's history log (the order's History tab). */
export class OrderHistoryPOM extends BasePOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Shown in place of the list while a filter is set that no entry of the order matches. */
  readonly noMatch: Locator
  /** Every entry loaded so far; each carries `data-event-type` and `data-history-id`. */
  readonly items: Locator
  /** The product filter's trigger; shown while the order has entries or a filter is set. */
  readonly productFilter: Locator
  /** The event filter's trigger; carries `data-value` = the event while one is picked. */
  readonly eventFilter: Locator
  /** Clears every filter; shown while one is set. */
  readonly clearFilters: Locator
  // The options render in popovers outside the section, so they are found on the page.
  /** The product filter's options, one per product of the order, cancelled ones included. */
  private readonly productOptions: Locator
  private readonly eventOptions: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.noMatch = this.root.getByTestId(IDS.noMatch)
    this.items = this.list.getByTestId(IDS.item)
    this.productFilter = this.root.getByTestId(IDS.filters.product)
    this.eventFilter = this.root.getByTestId(IDS.filters.event)
    this.clearFilters = this.root.getByTestId(IDS.filters.clear)
    this.productOptions = page.getByTestId(IDS.filters.productOption)
    this.eventOptions = page.getByTestId(IDS.filters.eventOption)
  }

  ofType(eventType: HistoryEvent): Locator {
    return this.withAttr(this.items, 'data-event-type', eventType)
  }

  /** One entry, picked by its `data-history-id`. */
  item(historyId: string): Locator {
    return this.withAttr(this.items, 'data-history-id', historyId)
  }

  /** The product filter's option for one product, picked by its `data-product-id`. */
  productOption(productId: string): Locator {
    return this.withAttr(this.productOptions, 'data-product-id', productId)
  }

  /** The event filter's option for one event. */
  eventOption(eventType: HistoryEvent): Locator {
    return this.withAttr(this.eventOptions, 'data-event-type', eventType)
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Narrows the tab to one event: picks it in the event filter and waits until the filter names it. */
  async filterByEvent(eventType: HistoryEvent): Promise<void> {
    await this.eventFilter.click()
    await this.eventOption(eventType).click()
    await this.withAttr(this.eventFilter, 'data-value', eventType).waitFor()
  }
}
