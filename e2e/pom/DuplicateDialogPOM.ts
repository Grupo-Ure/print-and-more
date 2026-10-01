import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.duplicateDialog

/** Duplicate an order: choose the products to copy and an optional new deadline. */
export class DuplicateDialogPOM extends BasePOM {
  readonly root: Locator
  readonly selectAll: Locator
  /** One checkbox per product; each carries `data-product-id`. */
  readonly products: Locator
  readonly deadline: Locator
  readonly error: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.selectAll = this.root.getByTestId(IDS.selectAll)
    this.products = this.root.getByTestId(IDS.product)
    this.deadline = this.root.getByTestId(IDS.deadline)
    this.error = this.root.getByTestId(IDS.error)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  product(productId: string): Locator {
    return this.withAttr(this.products, 'data-product-id', productId)
  }
}
