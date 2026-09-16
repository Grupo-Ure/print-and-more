import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { GrantApprovalDialogPOM } from './GrantApprovalDialogPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.settingsDialog

/** Per-job overrides (deadline / delivery / priority) and customer approval. */
export class JobSettingsDialogPOM extends BasePOM {
  readonly root: Locator
  readonly separateDeadline: Locator
  /** Carries `data-value` = ISO date when set. */
  readonly deadline: Locator
  readonly separateDelivery: Locator
  /** Carries `data-value`. */
  readonly delivery: Locator
  readonly separatePriority: Locator
  /** Carries `data-value`. */
  readonly priority: Locator
  readonly approvalRequired: Locator
  readonly grantApproval: Locator
  readonly approvalGranted: Locator
  readonly grantDialog: GrantApprovalDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.separateDeadline = this.root.getByTestId(IDS.separateDeadline)
    this.deadline = this.root.getByTestId(IDS.deadline)
    this.separateDelivery = this.root.getByTestId(IDS.separateDelivery)
    this.delivery = this.root.getByTestId(IDS.delivery)
    this.separatePriority = this.root.getByTestId(IDS.separatePriority)
    this.priority = this.root.getByTestId(IDS.priority)
    this.approvalRequired = this.root.getByTestId(IDS.approvalRequired)
    this.grantApproval = this.root.getByTestId(IDS.grantApproval)
    this.approvalGranted = this.root.getByTestId(IDS.approvalGranted)
    this.grantDialog = new GrantApprovalDialogPOM(page)
  }
}
