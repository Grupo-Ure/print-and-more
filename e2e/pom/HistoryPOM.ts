import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import type { Database } from '../../src/types/supabase'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

type HistoryEvent = Database['public']['Enums']['history_event']

const IDS = TEST_IDS.historyPage

/** The History page (admins): every history entry, newest first, with its filters. */
export class HistoryPOM extends BasePOM {
  readonly root: Locator
  readonly list: Locator
  /** Every entry loaded so far; each carries `data-event-type` and `data-history-id`. */
  readonly items: Locator
  /** The event filter's trigger. */
  readonly eventFilter: Locator
  /** The record filter's trigger; carries `data-value` = the record's id while one is picked. */
  readonly recordFilter: Locator
  /** The search field in the record filter's popover. */
  readonly recordSearch: Locator
  /** Clears every filter; shown while one is set. */
  readonly clearFilters: Locator
  // The options render in popovers outside the page's root, so they are found on the page.
  private readonly eventOptions: Locator
  private readonly recordOptions: Locator
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.list = this.root.getByTestId(IDS.list)
    this.items = this.list.getByTestId(IDS.item)
    this.eventFilter = this.root.getByTestId(IDS.filters.event)
    this.recordFilter = this.root.getByTestId(IDS.filters.record)
    this.recordSearch = page.getByTestId(IDS.filters.recordSearch)
    this.clearFilters = this.root.getByTestId(IDS.filters.clear)
    this.eventOptions = page.getByTestId(IDS.filters.eventOption)
    this.recordOptions = page.getByTestId(IDS.filters.recordOption)
    this.navbar = new NavbarPOM(page)
  }

  /** One entry, picked by its `data-history-id`. */
  item(historyId: string): Locator {
    return this.withAttr(this.items, 'data-history-id', historyId)
  }

  /** What one entry concerns, named beside its sentence; carries `data-record-kind`. An order's is a button that opens it. */
  recordOf(historyId: string): Locator {
    return this.item(historyId).getByTestId(IDS.record)
  }

  /** The event filter's option for one event. */
  eventOption(eventType: HistoryEvent): Locator {
    return this.withAttr(this.eventOptions, 'data-event-type', eventType)
  }

  /** The record filter's option for one record found by the search, picked by its `data-record-id`. */
  recordOption(recordId: string): Locator {
    return this.withAttr(this.recordOptions, 'data-record-id', recordId)
  }

  /** The ids of the entries loaded so far, in list order. */
  async renderedHistoryIds(): Promise<string[]> {
    return this.items.evaluateAll(els => els.map(el => el.getAttribute('data-history-id') ?? ''))
  }

  /** The event of each entry loaded so far, in list order. */
  async renderedEventTypes(): Promise<string[]> {
    return this.items.evaluateAll(els => els.map(el => el.getAttribute('data-event-type') ?? ''))
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Switches to the History page through the navbar and waits for it. */
  async open(): Promise<void> {
    await this.navbar.link('history').click()
    await this.root.waitFor()
  }

  /** Narrows the page to one record: searches for it, picks it and waits until the filter names it. */
  async narrowToRecord(search: string, recordId: string): Promise<void> {
    await this.recordFilter.click()
    await this.recordSearch.fill(search)
    await this.recordOption(recordId).click()
    await this.withAttr(this.recordFilter, 'data-value', recordId).waitFor()
  }
}
