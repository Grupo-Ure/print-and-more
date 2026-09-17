import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { StockTablePOM } from './StockTablePOM'
import { ConfirmDialogPOM } from './ConfirmDialogPOM'
import { AccessDeniedPOM } from './AccessDeniedPOM'
import { ToastPOM } from './ToastPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.textileStock

/**
 * Textile stock page (admins): variant stock and bookings. The master-data
 * subpage (brands → products → variants) is not modelled yet.
 */
export class TextileStockPOM extends BasePOM {
  readonly root: Locator
  readonly search: Locator
  readonly brandFilter: Locator
  readonly withSamples: Locator
  readonly reorder: Locator
  readonly masterData: Locator
  readonly backToStock: Locator
  readonly movementsButton: Locator
  readonly reorderDialog: Locator
  readonly movementsDialog: Locator
  readonly table: StockTablePOM
  readonly confirmDialog: ConfirmDialogPOM
  readonly accessDenied: AccessDeniedPOM
  readonly toast: ToastPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(TEST_IDS.stock.root)
    this.search = this.root.getByTestId(IDS.search)
    this.brandFilter = this.root.getByTestId(IDS.brandFilter)
    this.withSamples = this.root.getByTestId(IDS.withSamples)
    this.reorder = this.root.getByTestId(IDS.reorder)
    this.masterData = this.root.getByTestId(IDS.masterData)
    this.backToStock = this.root.getByTestId(IDS.backToStock)
    this.movementsButton = this.root.getByTestId(TEST_IDS.stock.movementsButton)
    this.reorderDialog = page.getByTestId(TEST_IDS.stock.reorderDialog.root)
    this.movementsDialog = page.getByTestId(TEST_IDS.stock.movementsDialog.root)
    this.table = new StockTablePOM(page)
    this.confirmDialog = new ConfirmDialogPOM(page)
    this.accessDenied = new AccessDeniedPOM(page)
    this.toast = new ToastPOM(page)
  }
}
