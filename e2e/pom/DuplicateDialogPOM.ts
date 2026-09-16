import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { withAttr } from '../support/locators'

const IDS = TEST_IDS.orders.duplicateDialog

/** Duplicate an order: choose the jobs to copy and an optional new deadline. */
export class DuplicateDialogPOM {
  readonly root: Locator
  readonly selectAll: Locator
  /** One checkbox per job; each carries `data-job-id`. */
  readonly jobs: Locator
  readonly deadline: Locator
  readonly error: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.selectAll = this.root.getByTestId(IDS.selectAll)
    this.jobs = this.root.getByTestId(IDS.job)
    this.deadline = this.root.getByTestId(IDS.deadline)
    this.error = this.root.getByTestId(IDS.error)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  job(jobId: string): Locator {
    return withAttr(this.jobs, 'data-job-id', jobId)
  }
}
