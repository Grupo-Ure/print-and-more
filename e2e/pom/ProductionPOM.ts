import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ProductionSidebarPOM } from './ProductionSidebarPOM'
import { ProductDetailPOM } from './ProductDetailPOM'
import { ConfirmDialogPOM } from './ConfirmDialogPOM'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.production

/**
 * The Production page: the cross-order product feed in the sidebar and the
 * selected product's detail — the same component as on the orders view —
 * beside it, under a strip naming its order.
 */
export class ProductionPOM extends BasePOM {
  readonly root: Locator
  /** Main area while no product is selected. */
  readonly placeholder: Locator
  readonly sidebar: ProductionSidebarPOM
  /** Main area with a product selected; carries `data-order-id` and `data-product-id`. */
  readonly productPanel: Locator
  readonly orderNumber: Locator
  readonly customerName: Locator
  readonly openInOrders: Locator
  /** The selected product's detail (shared with the orders view). */
  readonly productDetail: ProductDetailPOM
  readonly confirmDialog: ConfirmDialogPOM
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.placeholder = page.getByTestId(IDS.placeholder)
    this.sidebar = new ProductionSidebarPOM(page)
    this.productPanel = page.getByTestId(IDS.productPanel.root)
    this.orderNumber = this.productPanel.getByTestId(IDS.productPanel.orderNumber)
    this.customerName = this.productPanel.getByTestId(IDS.productPanel.customerName)
    this.openInOrders = this.productPanel.getByTestId(IDS.productPanel.openInOrders)
    this.productDetail = new ProductDetailPOM(page)
    this.confirmDialog = new ConfirmDialogPOM(page)
    this.navbar = new NavbarPOM(page)
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Switches to the Production page through the navbar and waits for the feed. */
  async open(): Promise<void> {
    await this.navbar.link('production').click()
    await this.sidebar.root.waitFor()
  }

  /** Switches to the Production page and widens the feed to everyone's products. */
  async openForEveryone(): Promise<void> {
    await this.open()
    await this.sidebar.showEveryone()
  }

  /**
   * Opens the page widened to everyone's products (a seeded product has no
   * assignee), selects the product in the feed and waits for its detail.
   */
  async openProduct(productId: string): Promise<void> {
    await this.openForEveryone()
    await this.sidebar.row(productId).click()
    await this.productDetail.forProduct(productId).waitFor()
  }
}
