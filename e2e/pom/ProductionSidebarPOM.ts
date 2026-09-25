import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.production.sidebar

/** Left column of the Production page: the assignee filter and the job feed. */
export class ProductionSidebarPOM extends BasePOM {
  readonly root: Locator
  /** The assignee combobox trigger; carries `data-value` = users.id while narrowed to one user. */
  readonly assigneeFilter: Locator
  /** The "everyone" option of the open combobox (a portal — not scoped to the sidebar). */
  readonly assigneeFilterEveryone: Locator
  /** States what the feed shows. */
  readonly assigneeFilterCaption: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every job row; each carries `data-job-id`, `data-order-id`, `data-status` and `data-department`. */
  readonly rows: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.assigneeFilter = this.root.getByTestId(IDS.assigneeFilter)
    this.assigneeFilterEveryone = page.getByTestId(IDS.assigneeFilterEveryone)
    this.assigneeFilterCaption = this.root.getByTestId(IDS.assigneeFilterCaption)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.list.getByTestId(IDS.empty)
    this.rows = this.list.getByTestId(IDS.row)
  }

  row(jobId: string): Locator {
    return this.withAttr(this.rows, 'data-job-id', jobId)
  }

  /** One user's option in the open combobox (a portal — not scoped to the sidebar). */
  assigneeFilterUser(userId: string): Locator {
    return this.withAttr(this.page.getByTestId(IDS.assigneeFilterUser), 'data-user-id', userId)
  }

  /**
   * Widens the feed from the signed-in user's own jobs to everyone's and waits
   * for the filter to drop its user. Navigation, for a spec's Setup stage.
   */
  async showEveryone(): Promise<void> {
    await this.assigneeFilter.click()
    await this.assigneeFilterEveryone.click()
    await this.assigneeFilter.and(this.page.locator(':not([data-value])')).waitFor()
  }

  rowJobNumber(row: Locator): Locator {
    return row.getByTestId(IDS.rowJobNumber)
  }

  rowCustomer(row: Locator): Locator {
    return row.getByTestId(IDS.rowCustomer)
  }

  /** Carries `data-status`. */
  rowStatus(row: Locator): Locator {
    return row.getByTestId(IDS.rowStatus)
  }

  /** Carries `data-user-id` while assigned. */
  rowAssignee(row: Locator): Locator {
    return row.getByTestId(IDS.rowAssignee)
  }

  /** The ids of the jobs currently listed, in feed order. */
  async listedJobIds(): Promise<string[]> {
    return this.rows.evaluateAll(els => els.map(el => el.getAttribute('data-job-id') ?? ''))
  }
}
