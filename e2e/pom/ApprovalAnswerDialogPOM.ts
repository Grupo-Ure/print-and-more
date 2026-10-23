import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.files.answerDialog

/** The dialog that records the customer's answer to an open round by hand; carries `data-decision`. */
export class ApprovalAnswerDialogPOM extends BasePOM {
  readonly root: Locator
  readonly note: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    // The dialog is portalled out of the tab, so it is found on the page.
    this.root = page.getByTestId(IDS.root)
    this.note = this.root.getByTestId(IDS.note)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }
}
