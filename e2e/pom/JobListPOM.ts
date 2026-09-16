import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { withAttr } from '../support/locators'
import { JobContextMenuPOM } from './JobContextMenuPOM'
import type { Department } from '../../src/types/database'

const IDS = TEST_IDS.orders.jobList

/** The job column: one add-job button per department and a row per job. */
export class JobListPOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every job row; each carries `data-job-id`, `data-status`, and `aria-current` when selected. */
  readonly rows: Locator
  readonly contextMenu: JobContextMenuPOM
  private readonly addJobButtons: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.addJobButtons = this.root.getByTestId(IDS.addJob)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.list.getByTestId(IDS.row)
    this.contextMenu = new JobContextMenuPOM(page)
  }

  addJob(department: Department): Locator {
    return withAttr(this.addJobButtons, 'data-department', department)
  }

  row(jobId: string): Locator {
    return withAttr(this.rows, 'data-job-id', jobId)
  }

  rowMissingInfo(row: Locator): Locator {
    return row.getByTestId(IDS.rowMissingInfo)
  }
}
