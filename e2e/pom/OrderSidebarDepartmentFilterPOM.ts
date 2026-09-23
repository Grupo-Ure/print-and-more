import type { Locator, Page } from '@playwright/test'
import type { Department } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar.filters.department

/** The department filter popover (multi-select icon toggles). */
export class OrderSidebarDepartmentFilterPOM extends BasePOM {
  readonly root: Locator
  readonly reset: Locator
  private readonly options: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.options = this.root.getByTestId(IDS.option)
    this.reset = this.root.getByTestId(IDS.reset)
  }

  /** Carries `aria-pressed`. */
  option(department: Department): Locator {
    return this.withAttr(this.options, 'data-department', department)
  }
}
