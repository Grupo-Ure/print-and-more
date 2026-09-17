import type { Locator, Page } from '@playwright/test'
import type { JobStatus } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { ForceReleaseDialogPOM } from './ForceReleaseDialogPOM'
import { ProductSectionPOM } from './ProductSectionPOM'
import { JobSettingsDialogPOM } from './JobSettingsDialogPOM'
import { TimeLogsDialogPOM } from './TimeLogsDialogPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail

/**
 * The active job: header (assignee, status, actions, release button), the
 * banner naming unmet requirements, and the product section. The root
 * carries `data-job-id`, `data-status` and `data-department`.
 */
export class JobDetailPOM extends BasePOM {
  readonly root: Locator
  readonly title: Locator
  /** Carries `data-value` = assignee user id. */
  readonly assignee: Locator
  /** Carries `data-status`. */
  readonly status: Locator
  readonly settingsButton: Locator
  readonly timeLogsButton: Locator
  readonly pdfButton: Locator
  readonly deleteButton: Locator
  readonly cancelButton: Locator

  /** The forward workflow action; carries `data-target` = target JobStatus. */
  readonly releaseButton: Locator
  readonly releaseMenuTrigger: Locator
  readonly forceReleaseItem: Locator
  readonly forceReleaseDialog: ForceReleaseDialogPOM

  /** Carries `data-kind` = done | shortage | blocked | production. */
  readonly banner: Locator
  readonly backToPrepress: Locator

  readonly products: ProductSectionPOM
  readonly settingsDialog: JobSettingsDialogPOM
  readonly timeLogsDialog: TimeLogsDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.title = this.root.getByTestId(IDS.title)
    this.assignee = this.root.getByTestId(IDS.assignee)
    this.status = this.root.getByTestId(IDS.status)
    this.settingsButton = this.root.getByTestId(IDS.settingsButton)
    this.timeLogsButton = this.root.getByTestId(IDS.timeLogsButton)
    this.pdfButton = this.root.getByTestId(IDS.pdfButton)
    this.deleteButton = this.root.getByTestId(IDS.deleteButton)
    this.cancelButton = this.root.getByTestId(IDS.cancelButton)

    this.releaseButton = this.root.getByTestId(IDS.release.button)
    this.releaseMenuTrigger = this.root.getByTestId(IDS.release.menuTrigger)
    // Dropdown content is portalled, so not scoped to the root.
    this.forceReleaseItem = page.getByTestId(IDS.release.forceItem)
    this.forceReleaseDialog = new ForceReleaseDialogPOM(page)

    this.banner = this.root.getByTestId(IDS.banner.root)
    this.backToPrepress = this.banner.getByTestId(IDS.banner.backToPrepress)

    this.products = new ProductSectionPOM(page)
    this.settingsDialog = new JobSettingsDialogPOM(page)
    this.timeLogsDialog = new TimeLogsDialogPOM(page)
  }

  /** The job detail only while it shows this job. */
  forJob(jobId: string): Locator {
    return this.withAttr(this.root, 'data-job-id', jobId)
  }

  /** The release button only while its next step is this status — to wait for the previous step to land. */
  releaseButtonTo(target: JobStatus): Locator {
    return this.withAttr(this.releaseButton, 'data-target', target)
  }
}
