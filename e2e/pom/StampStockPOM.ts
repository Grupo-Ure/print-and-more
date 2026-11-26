import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { StockTablePOM } from './StockTablePOM'
import { StampModelDialogPOM } from './StampModelDialogPOM'
import { ConfirmDialogPOM } from './ConfirmDialogPOM'
import { AccessDeniedPOM } from './AccessDeniedPOM'
import { ToastPOM } from './ToastPOM'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.stampStock

/** Stamp stock page (admins): models, bookings, reorder list, movements. */
export class StampStockPOM extends BasePOM {
  readonly root: Locator
  readonly newModel: Locator
  readonly search: Locator
  readonly typeFilter: Locator
  readonly colourFilter: Locator
  readonly showInactive: Locator
  readonly reorder: Locator
  readonly movementsButton: Locator
  readonly reorderDialog: Locator
  readonly movementsDialog: Locator
  readonly table: StockTablePOM
  readonly modelDialog: StampModelDialogPOM
  readonly confirmDialog: ConfirmDialogPOM
  readonly accessDenied: AccessDeniedPOM
  readonly toast: ToastPOM
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(TEST_IDS.stock.root)
    this.newModel = this.root.getByTestId(IDS.newModel)
    this.search = this.root.getByTestId(IDS.search)
    this.typeFilter = this.root.getByTestId(IDS.typeFilter)
    this.colourFilter = this.root.getByTestId(IDS.colourFilter)
    this.showInactive = this.root.getByTestId(IDS.showInactive)
    this.reorder = this.root.getByTestId(IDS.reorder)
    this.movementsButton = this.root.getByTestId(TEST_IDS.stock.movementsButton)
    this.reorderDialog = page.getByTestId(TEST_IDS.stock.reorderDialog.root)
    this.movementsDialog = page.getByTestId(TEST_IDS.stock.movementsDialog.root)
    this.table = new StockTablePOM(page)
    this.modelDialog = new StampModelDialogPOM(page)
    this.confirmDialog = new ConfirmDialogPOM(page)
    this.accessDenied = new AccessDeniedPOM(page)
    this.toast = new ToastPOM(page)
    this.navbar = new NavbarPOM(page)
  }

  rowEdit(row: Locator): Locator {
    return row.getByTestId(IDS.rowEdit)
  }

  /** One line of the movement list in its dialog, picked by the id of the stock entry it shows. */
  movementRow(entryId: string): Locator {
    return this.withAttr(this.movementsDialog.getByTestId(TEST_IDS.stock.table.row), 'data-row-id', entryId)
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Switches to the stamp stock page through the navbar, narrows the table to the model by name and waits for its row. */
  async openOnModel(modelName: string, modelId: string): Promise<void> {
    await this.navbar.link('stampStock').click()
    await this.search.fill(modelName)
    await this.table.row(modelId).waitFor()
  }

  /** Carries `data-active` = "true" | "false". */
  rowToggleActive(row: Locator): Locator {
    return row.getByTestId(IDS.rowToggleActive)
  }
}
