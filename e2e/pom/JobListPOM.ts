import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { JobContextMenuPOM } from './JobContextMenuPOM'
import type { Department, JobStatus } from '../../src/types/database'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobList

/** The job column: one add-job button per department and a row per job. */
export class JobListPOM extends BasePOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every job row; each carries `data-job-id`, `data-status`, and `aria-current` when selected. */
  readonly rows: Locator
  /** The row of the active job (the one `JobDetail` shows). */
  readonly selectedRow: Locator
  readonly contextMenu: JobContextMenuPOM
  private readonly addJobButtons: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.addJobButtons = this.root.getByTestId(IDS.addJob)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.list.getByTestId(IDS.row)
    this.selectedRow = this.withAttr(this.rows, 'aria-current', 'true')
    this.contextMenu = new JobContextMenuPOM(page)
  }

  addJob(department: Department): Locator {
    return this.withAttr(this.addJobButtons, 'data-department', department)
  }

  row(jobId: string): Locator {
    return this.withAttr(this.rows, 'data-job-id', jobId)
  }

  /** The job's row only while the job is in this status — to wait for a transition to land. */
  rowInStatus(jobId: string, status: JobStatus): Locator {
    return this.withAttr(this.row(jobId), 'data-status', status)
  }

  rowMissingInfo(row: Locator): Locator {
    return row.getByTestId(IDS.rowMissingInfo)
  }

  /** The status every listed job is in, keyed by job id — a read for `expect.poll`. */
  async rowStatuses(): Promise<Record<string, JobStatus | null>> {
    return this.rows.evaluateAll(elements =>
      Object.fromEntries(
        elements.map(element => [element.getAttribute('data-job-id'), element.getAttribute('data-status')]),
      ),
    )
  }
}
