import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.files.requests

/**
 * The product's approval rounds below its files, newest first. A row carries
 * `data-request-id`, `data-round` and `data-status`; the open round carries
 * the approve, request-changes and withdraw buttons. Clicking a row opens the
 * round's details, which hold its files and who settled it.
 */
export class ApprovalRequestsPOM extends BasePOM {
  readonly root: Locator
  /** Shown while the product has no round. */
  readonly empty: Locator
  readonly rows: Locator
  /** The details dialog of the round whose row was clicked. */
  readonly details: Locator
  /** In the open details: who recorded the answer or withdrew the round; carries `data-user-name`. */
  readonly settledBy: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.root.getByTestId(IDS.row)
    this.details = page.getByTestId(IDS.details)
    this.settledBy = this.details.getByTestId(IDS.settledBy)
  }

  row(requestId: string): Locator {
    return this.withAttr(this.rows, 'data-request-id', requestId)
  }

  /** The row of the product's round with this number. */
  round(round: number): Locator {
    return this.withAttr(this.rows, 'data-round', String(round))
  }

  /** One of the open details' files, by the order file it is a copy of. */
  file(fileId: string): Locator {
    return this.withAttr(this.details.getByTestId(IDS.file), 'data-file-id', fileId)
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
