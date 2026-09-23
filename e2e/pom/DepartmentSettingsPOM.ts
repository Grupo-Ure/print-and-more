import type { Locator, Page } from '@playwright/test'
import type { Department } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.departments

/** Settings → Departments: one row per department with its default-assignee combobox. */
export class DepartmentSettingsPOM extends BasePOM {
  readonly root: Locator
  /** Every department row; each carries `data-department`. */
  readonly rows: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.rows = this.root.getByTestId(IDS.row)
  }

  row(department: Department): Locator {
    return this.withAttr(this.rows, 'data-department', department)
  }

  /** The combobox trigger; carries `data-value` = users.id while a default is set. */
  rowAssignee(row: Locator): Locator {
    return row.getByTestId(IDS.rowAssignee)
  }
}
