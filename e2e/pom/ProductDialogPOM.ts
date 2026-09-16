import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.products.dialog

/**
 * Add / edit / view a product. Carries `data-mode` = add | edit | view. The
 * per-type form fields are not modelled yet — they come with the specs that
 * need them.
 */
export class ProductDialogPOM extends BasePOM {
  readonly root: Locator
  /** Step 1 of "add": one button per product type; each carries `data-type`. */
  readonly typeOptions: Locator
  readonly back: Locator
  readonly edit: Locator
  readonly close: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.typeOptions = this.root.getByTestId(IDS.typeOption)
    this.back = this.root.getByTestId(IDS.back)
    this.edit = this.root.getByTestId(IDS.edit)
    this.close = this.root.getByTestId(IDS.close)
  }

  typeOption(type: string): Locator {
    return this.withAttr(this.typeOptions, 'data-type', type)
  }
}
