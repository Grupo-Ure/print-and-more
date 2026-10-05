import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productList.contextMenu

/** Right-click menu of a product row (rendered in a portal, so not row-scoped). */
export class ProductContextMenuPOM extends BasePOM {
  /** Advances one workflow step; carries `data-target` = target ProductStatus. */
  readonly advance: Locator
  readonly delete: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    super(page)
    this.advance = page.getByTestId(IDS.advance)
    this.delete = page.getByTestId(IDS.delete)
    this.cancel = page.getByTestId(IDS.cancel)
  }
}
