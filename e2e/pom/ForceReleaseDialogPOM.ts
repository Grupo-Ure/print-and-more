import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.orders.jobDetail.release.dialog

/** Admin-only: reason prompt for the emergency release to production. */
export class ForceReleaseDialogPOM {
  readonly root: Locator
  readonly reason: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.reason = this.root.getByTestId(IDS.reason)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }
}
