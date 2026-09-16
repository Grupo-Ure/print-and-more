import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { withAttr } from '../support/locators'
import type { Database } from '../../src/types/supabase'

type HistoryEvent = Database['public']['Enums']['history_event']

const IDS = TEST_IDS.orders.details.historyDialog

/** The order's history log. */
export class OrderHistoryDialogPOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every entry; each carries `data-event-type`. */
  readonly items: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.items = this.list.getByTestId(IDS.item)
  }

  ofType(eventType: HistoryEvent): Locator {
    return withAttr(this.items, 'data-event-type', eventType)
  }
}
