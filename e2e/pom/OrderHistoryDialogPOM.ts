import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import type { Database } from '../../src/types/supabase'
import { BasePOM } from './BasePOM'

type HistoryEvent = Database['public']['Enums']['history_event']

const IDS = TEST_IDS.orders.details.historyDialog

/** The order's history log. */
export class OrderHistoryDialogPOM extends BasePOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every entry; each carries `data-event-type`. */
  readonly items: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.items = this.list.getByTestId(IDS.item)
  }

  ofType(eventType: HistoryEvent): Locator {
    return this.withAttr(this.items, 'data-event-type', eventType)
  }
}
