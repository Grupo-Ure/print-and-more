import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.files.requests

/**
 * The product's approval rounds below its files, newest first. A row carries
 * `data-request-id`, `data-round` and `data-status`; the open round carries
 * the approve, request-changes and withdraw buttons.
 */
export class ApprovalRequestsPOM extends BasePOM {
  readonly root: Locator
  /** Shown while the product has no round. */
  readonly empty: Locator
  readonly rows: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.root.getByTestId(IDS.row)
  }

  row(requestId: string): Locator {
    return this.withAttr(this.rows, 'data-request-id', requestId)
  }

  /** The row of the product's round with this number. */
  round(round: number): Locator {
    return this.withAttr(this.rows, 'data-round', String(round))
  }

  /** One of the round's files, by the order file it is a copy of. */
  file(row: Locator, fileId: string): Locator {
    return this.withAttr(row.getByTestId(IDS.file), 'data-file-id', fileId)
  }

  /** Who recorded the answer or withdrew the round; carries `data-user-name`. */
  settledBy(row: Locator): Locator {
    return row.getByTestId(IDS.settledBy)
  }

  approve(row: Locator): Locator {
    return row.getByTestId(IDS.approve)
  }

  requestChanges(row: Locator): Locator {
    return row.getByTestId(IDS.requestChanges)
  }

  withdraw(row: Locator): Locator {
    return row.getByTestId(IDS.withdraw)
  }
}
