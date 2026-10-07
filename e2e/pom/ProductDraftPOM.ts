import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDraft
const FORM_IDS = TEST_IDS.orders.productDetail.basicInfo

/**
 * The unsaved product in the detail pane: the picked type's own form, with no
 * workflow header and no tabs. Carries `data-department` and `data-type`.
 *
 * The form is the same per-type form the Basic info tab renders, so it carries
 * that tab's test IDs — scoped to this panel's root here, so the two can never
 * resolve to each other.
 */
export class ProductDraftPOM extends BasePOM {
  readonly root: Locator
  readonly title: Locator
  /** Every form input; each carries `data-field` = the form field name. */
  readonly fields: Locator
  readonly submit: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.title = this.root.getByTestId(IDS.title)
    this.fields = this.root.getByTestId(FORM_IDS.field)
    this.submit = this.root.getByTestId(FORM_IDS.submit)
    this.cancel = this.root.getByTestId(FORM_IDS.cancel)
  }

  field(name: string): Locator {
    return this.withAttr(this.fields, 'data-field', name)
  }
}
