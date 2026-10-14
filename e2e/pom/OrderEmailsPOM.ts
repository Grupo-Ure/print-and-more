import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.details.emails

/** The order's mails (the order's Emails tab): waiting, failed and sent, read-only. */
export class OrderEmailsPOM extends BasePOM {
  readonly root: Locator
  readonly empty: Locator
  /** Every mail waiting on the queue; each carries `data-msg-id`. */
  readonly queuedItems: Locator
  /** Every mail that went out; each carries `data-sent-email-id`. */
  readonly sentItems: Locator
  /** Every mail the sender gave up on; each carries `data-history-id`. */
  readonly failedItems: Locator
  /** The View button of every sent mail. */
  readonly viewSent: Locator
  readonly sentDialog: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.empty = this.root.getByTestId(IDS.empty)
    this.queuedItems = this.root.getByTestId(IDS.queuedItem)
    this.sentItems = this.root.getByTestId(IDS.sentItem)
    this.failedItems = this.root.getByTestId(IDS.failedItem)
    this.viewSent = this.sentItems.getByTestId(IDS.viewSent)
    // The dialog is portalled out of the tab, so it is found on the page.
    this.sentDialog = page.getByTestId(IDS.sentDialog)
  }

  queued(msgId: number): Locator {
    return this.withAttr(this.queuedItems, 'data-msg-id', String(msgId))
  }
}
