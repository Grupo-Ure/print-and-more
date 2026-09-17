import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { OrderSidebarPOM } from './OrderSidebarPOM'
import { OrderDetailsPOM } from './OrderDetailsPOM'
import { NewOrderDialogPOM } from './NewOrderDialogPOM'
import { CustomerDialogPOM } from './CustomerDialogPOM'
import { DuplicateDialogPOM } from './DuplicateDialogPOM'
import { ConfirmDialogPOM } from './ConfirmDialogPOM'
import { ToastPOM } from './ToastPOM'
import { BasePOM } from './BasePOM'

/** What the navigation helpers need to know about a job: which order it is in. */
type JobRef = { id: string; orderId: string }

/**
 * The orders view — the app's main screen. Everything a spec needs is reachable
 * from here: the sidebar, the selected order's details (with job list and
 * active job), and every dialog the view can open.
 */
export class OrdersPOM extends BasePOM {
  /** Centre column while no order is selected. */
  readonly welcome: Locator
  readonly sidebar: OrderSidebarPOM
  readonly details: OrderDetailsPOM
  readonly newOrderDialog: NewOrderDialogPOM
  readonly customerDialog: CustomerDialogPOM
  readonly duplicateDialog: DuplicateDialogPOM
  readonly confirmDialog: ConfirmDialogPOM
  readonly toast: ToastPOM

  constructor(page: Page) {
    super(page)
    this.welcome = page.getByTestId(TEST_IDS.orders.welcome)
    this.sidebar = new OrderSidebarPOM(page)
    this.details = new OrderDetailsPOM(page)
    this.newOrderDialog = new NewOrderDialogPOM(page)
    this.customerDialog = new CustomerDialogPOM(page)
    this.duplicateDialog = new DuplicateDialogPOM(page)
    this.confirmDialog = new ConfirmDialogPOM(page)
    this.toast = new ToastPOM(page)
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Selects the order in the sidebar and waits for its details. */
  async openOrder(orderId: string): Promise<void> {
    await this.sidebar.row(orderId).click()
    await this.details.forOrder(orderId).waitFor()
  }

  /** Opens the job's order, selects the job and waits for its detail. */
  async openJob(job: JobRef): Promise<void> {
    await this.openOrder(job.orderId)
    await this.details.jobList.row(job.id).click()
    await this.details.jobDetail.forJob(job.id).waitFor()
  }

  /** Opens the job and its settings dialog. */
  async openJobSettings(job: JobRef): Promise<void> {
    await this.openJob(job)
    await this.details.jobDetail.settingsButton.click()
    await this.details.jobDetail.settingsDialog.root.waitFor()
  }
}
