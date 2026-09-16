import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.stampStock.modelDialog

/** Create / edit a stamp model. Form fields come with the specs that need them. */
export class StampModelDialogPOM {
  readonly root: Locator
  readonly cancel: Locator
  readonly save: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.save = this.root.getByTestId(IDS.save)
  }
}
