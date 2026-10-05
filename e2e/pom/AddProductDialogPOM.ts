import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productList.addDialog
const FORM_IDS = TEST_IDS.orders.productDetail.basicInfo

/**
 * The add-product dialog: department → type → the type's own form. Carries
 * `data-department` and, once a type is settled, `data-type`; a department
 * with a single product type has nothing to pick and opens on its form.
 *
 * The form is the same per-type form the Basic info tab renders, so it carries
 * that tab's test IDs — scoped to this dialog's root here, so the two can
 * never resolve to each other.
 */
export class AddProductDialogPOM extends BasePOM {
  readonly root: Locator
  /** One button per product type of the chosen department; each carries `data-type`. */
  readonly typeOptions: Locator
  /** Back to the type picker (absent for a single-type department). */
  readonly back: Locator
  /** Every form input; each carries `data-field` = the form field name. */
  readonly fields: Locator
  readonly submit: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.typeOptions = this.root.getByTestId(IDS.typeOption)
    this.back = this.root.getByTestId(IDS.back)
    this.fields = this.root.getByTestId(FORM_IDS.field)
    this.submit = this.root.getByTestId(FORM_IDS.submit)
    this.cancel = this.root.getByTestId(FORM_IDS.cancel)
  }

  typeOption(type: string): Locator {
    return this.withAttr(this.typeOptions, 'data-type', type)
  }

  field(name: string): Locator {
    return this.withAttr(this.fields, 'data-field', name)
  }
}
