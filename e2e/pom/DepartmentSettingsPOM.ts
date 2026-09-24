import type { Locator, Page } from '@playwright/test'
import type { DefaultAssigneeStatus, Department } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.departments

/** Settings → Departments: one row per department with a default-assignee combobox per stage (pre-press, production). */
export class DepartmentSettingsPOM extends BasePOM {
  readonly root: Locator
  /** Every department row; each carries `data-department`. */
  readonly rows: Locator
  /** The "Unassigned" choice of whichever combobox is open (portalled, so not scoped to the root). */
  readonly emptyOption: Locator
  private readonly userOptions: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.rows = this.root.getByTestId(IDS.row)
    this.emptyOption = page.getByTestId(IDS.rowAssigneeEmptyOption)
    this.userOptions = page.getByTestId(IDS.rowAssigneeUserOption)
  }

  row(department: Department): Locator {
    return this.withAttr(this.rows, 'data-department', department)
  }

  /** The stage's combobox trigger; carries `data-value` = users.id while a default is set. */
  rowAssignee(row: Locator, status: DefaultAssigneeStatus): Locator {
    return row.getByTestId(status === 'PREPRESS' ? IDS.rowPrepressAssignee : IDS.rowProductionAssignee)
  }

  /** A user in the open combobox's list, picked by its `data-user-id`. */
  userOption(userId: string): Locator {
    return this.withAttr(this.userOptions, 'data-user-id', userId)
  }
}
