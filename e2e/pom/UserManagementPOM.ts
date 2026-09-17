import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { CreateAccountDialogPOM } from './CreateAccountDialogPOM'
import { ConfirmDialogPOM } from './ConfirmDialogPOM'
import { AccessDeniedPOM } from './AccessDeniedPOM'
import { ToastPOM } from './ToastPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.userManagement

/** User management page (super admins): accounts table, role changes, deletion. */
export class UserManagementPOM extends BasePOM {
  readonly root: Locator
  readonly create: Locator
  readonly table: Locator
  /** Every account row; each carries `data-user-id` and `data-role`. */
  readonly rows: Locator
  readonly createDialog: CreateAccountDialogPOM
  readonly confirmDialog: ConfirmDialogPOM
  readonly accessDenied: AccessDeniedPOM
  readonly toast: ToastPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.create = this.root.getByTestId(IDS.create)
    this.table = this.root.getByTestId(IDS.table)
    this.rows = this.table.getByTestId(IDS.row)
    this.createDialog = new CreateAccountDialogPOM(page)
    this.confirmDialog = new ConfirmDialogPOM(page)
    this.accessDenied = new AccessDeniedPOM(page)
    this.toast = new ToastPOM(page)
  }

  row(userId: string): Locator {
    return this.withAttr(this.rows, 'data-user-id', userId)
  }

  /** Role select for accounts the current user may change; carries `data-value`. */
  rowRole(row: Locator): Locator {
    return row.getByTestId(IDS.rowRole)
  }

  /** Read-only role badge for the rest; carries `data-value`. */
  rowRoleBadge(row: Locator): Locator {
    return row.getByTestId(IDS.rowRoleBadge)
  }

  rowDelete(row: Locator): Locator {
    return row.getByTestId(IDS.rowDelete)
  }
}
