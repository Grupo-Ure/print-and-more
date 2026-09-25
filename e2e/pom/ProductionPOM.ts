import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ProductionSidebarPOM } from './ProductionSidebarPOM'
import { JobDetailPOM } from './JobDetailPOM'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.production

/**
 * The Production page: the cross-order job feed in the sidebar and the
 * selected job's detail — the same component as on the orders view — beside
 * it, under a strip naming its order.
 */
export class ProductionPOM extends BasePOM {
  readonly root: Locator
  /** Main area while no job is selected. */
  readonly placeholder: Locator
  readonly sidebar: ProductionSidebarPOM
  /** Main area with a job selected; carries `data-order-id` and `data-job-id`. */
  readonly jobPanel: Locator
  readonly orderNumber: Locator
  readonly customerName: Locator
  readonly openInOrders: Locator
  /** The selected job's detail (shared with the orders view). */
  readonly jobDetail: JobDetailPOM
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.placeholder = page.getByTestId(IDS.placeholder)
    this.sidebar = new ProductionSidebarPOM(page)
    this.jobPanel = page.getByTestId(IDS.jobPanel.root)
    this.orderNumber = this.jobPanel.getByTestId(IDS.jobPanel.orderNumber)
    this.customerName = this.jobPanel.getByTestId(IDS.jobPanel.customerName)
    this.openInOrders = this.jobPanel.getByTestId(IDS.jobPanel.openInOrders)
    this.jobDetail = new JobDetailPOM(page)
    this.navbar = new NavbarPOM(page)
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Switches to the Production page through the navbar and waits for the feed. */
  async open(): Promise<void> {
    await this.navbar.link('production').click()
    await this.sidebar.root.waitFor()
  }

  /** Switches to the Production page and widens the feed to everyone's jobs. */
  async openForEveryone(): Promise<void> {
    await this.open()
    await this.sidebar.showEveryone()
  }

  /**
   * Opens the page widened to everyone's jobs (a seeded job has no assignee),
   * selects the job in the feed and waits for its detail.
   */
  async openJob(jobId: string): Promise<void> {
    await this.openForEveryone()
    await this.sidebar.row(jobId).click()
    await this.jobDetail.forJob(jobId).waitFor()
  }
}
