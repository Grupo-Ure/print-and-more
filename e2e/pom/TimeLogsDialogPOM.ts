import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.timeLogsDialog

/** Worked time on the active job. */
export class TimeLogsDialogPOM extends BasePOM {
  readonly root: Locator
  /** Carries `data-minutes`. */
  readonly total: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every entry; each carries `data-log-id` and `data-minutes`. */
  readonly items: Locator
  readonly minutes: Locator
  /** Admin only: who the time is attributed to; carries `data-value` = user id. */
  readonly onBehalfOf: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.total = this.root.getByTestId(IDS.total)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.items = this.list.getByTestId(IDS.item)
    this.minutes = this.root.getByTestId(IDS.minutes)
    this.onBehalfOf = this.root.getByTestId(IDS.onBehalfOf)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  item(logId: string): Locator {
    return this.withAttr(this.items, 'data-log-id', logId)
  }

  itemDelete(item: Locator): Locator {
    return item.getByTestId(IDS.itemDelete)
  }
}
