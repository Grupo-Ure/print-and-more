import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.products.dialog

/**
 * Add / edit / view a product. Carries `data-mode` = add | edit | view. The
 * form inputs share one test ID whatever the product type and carry the form
 * field name in `data-field`, so a spec addresses them by name.
 */
export class ProductDialogPOM extends BasePOM {
  readonly root: Locator
  /** Step 1 of "add": one button per product type; each carries `data-type`. */
  readonly typeOptions: Locator
  /** Every form input; each carries `data-field`. */
  readonly fields: Locator
  readonly submit: Locator
  readonly cancel: Locator
  readonly back: Locator
  readonly edit: Locator
  readonly close: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.typeOptions = this.root.getByTestId(IDS.typeOption)
    this.fields = this.root.getByTestId(IDS.field)
    this.submit = this.root.getByTestId(IDS.submit)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.back = this.root.getByTestId(IDS.back)
    this.edit = this.root.getByTestId(IDS.edit)
    this.close = this.root.getByTestId(IDS.close)
  }

  typeOption(type: string): Locator {
    return this.withAttr(this.typeOptions, 'data-type', type)
  }

  field(name: string): Locator {
    return this.withAttr(this.fields, 'data-field', name)
  }

  /** Fills each named form field with its value, in the given order. */
  async fill(values: Record<string, string>): Promise<void> {
    for (const [name, value] of Object.entries(values)) {
      await this.field(name).fill(value)
    }
  }
}
