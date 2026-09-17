import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.confirmDialog

/** The app-wide `useConfirm()` dialog (archive, cancel, delete, mark done…). */
export class ConfirmDialogPOM extends BasePOM {
  readonly root: Locator
  readonly title: Locator
  readonly confirm: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.title = this.root.getByTestId(IDS.title)
    this.confirm = this.root.getByTestId(IDS.confirm)
    this.cancel = this.root.getByTestId(IDS.cancel)
  }
}
