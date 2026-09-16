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
}
