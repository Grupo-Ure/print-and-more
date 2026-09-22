import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar.filters.deadline

/** The deadline filter popover (deadline and intake date ranges). */
export class OrderSidebarDeadlineFilterPOM extends BasePOM {
  readonly root: Locator
  readonly deadlineFrom: Locator
  readonly deadlineTo: Locator
  readonly intakeFrom: Locator
  readonly intakeTo: Locator
  readonly reset: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.deadlineFrom = this.root.getByTestId(IDS.deadlineFrom)
    this.deadlineTo = this.root.getByTestId(IDS.deadlineTo)
    this.intakeFrom = this.root.getByTestId(IDS.intakeFrom)
    this.intakeTo = this.root.getByTestId(IDS.intakeTo)
    this.reset = this.root.getByTestId(IDS.reset)
  }
}
