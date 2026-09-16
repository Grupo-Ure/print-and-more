import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.confirmDialog

/** The app-wide `useConfirm()` dialog (archive, cancel, delete, mark done…). */
export class ConfirmDialogPOM {
  readonly root: Locator
  readonly title: Locator
  readonly confirm: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.title = this.root.getByTestId(IDS.title)
    this.confirm = this.root.getByTestId(IDS.confirm)
    this.cancel = this.root.getByTestId(IDS.cancel)
  }
}
