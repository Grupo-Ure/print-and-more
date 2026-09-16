import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.orders.jobList.contextMenu

/** Right-click menu of a job row (rendered in a portal, so not row-scoped). */
export class JobContextMenuPOM {
  /** Advances one workflow step; carries `data-target` = target JobStatus. */
  readonly advance: Locator
  readonly delete: Locator
  readonly cancel: Locator

  constructor(page: Page) {
    this.advance = page.getByTestId(IDS.advance)
    this.delete = page.getByTestId(IDS.delete)
    this.cancel = page.getByTestId(IDS.cancel)
  }
}
