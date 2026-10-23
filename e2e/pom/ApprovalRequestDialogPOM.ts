import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.files.requestDialog

/** The dialog that sends an approval round: the files offered, the note, the mail switch and the stock warning. */
export class ApprovalRequestDialogPOM extends BasePOM {
  readonly root: Locator
  /** Every file offered; each carries `data-file-id` and `data-state` = checked | unchecked. */
  readonly files: Locator
  readonly message: Locator
  readonly mailed: Locator
  /** The stock warning, present only while the product is short. */
  readonly shortages: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    // The dialog is portalled out of the tab, so it is found on the page.
    this.root = page.getByTestId(IDS.root)
    this.files = this.root.getByTestId(IDS.file)
    this.message = this.root.getByTestId(IDS.message)
    this.mailed = this.root.getByTestId(IDS.mailed)
    this.shortages = this.root.getByTestId(IDS.shortages)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  file(fileId: string): Locator {
    return this.withAttr(this.files, 'data-file-id', fileId)
  }

  /** The file's checkbox inside its row. */
  fileCheckbox(fileId: string): Locator {
    return this.file(fileId).getByTestId(IDS.fileSelect)
  }

  /** The warning's line for one short stock target. */
  shortage(targetId: string): Locator {
    return this.withAttr(this.shortages.getByTestId(IDS.shortage), 'data-target-id', targetId)
  }

  /** The ids of the files currently ticked. */
  async checkedFileIds(): Promise<string[]> {
    return this.withAttr(this.files, 'data-state', 'checked').evaluateAll(rows =>
      rows.map(row => row.getAttribute('data-file-id') ?? ''),
    )
  }
}
