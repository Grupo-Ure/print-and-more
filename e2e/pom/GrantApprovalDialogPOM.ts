import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.settingsDialog.grantDialog

/** Pick which of the order's files the customer approved. */
export class GrantApprovalDialogPOM extends BasePOM {
  readonly root: Locator
  readonly addFiles: Locator
  /** One radio per file; each carries `data-file-id`. */
  readonly files: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.addFiles = this.root.getByTestId(IDS.addFiles)
    this.files = this.root.getByTestId(IDS.file)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  file(fileId: string): Locator {
    return this.withAttr(this.files, 'data-file-id', fileId)
  }
}
