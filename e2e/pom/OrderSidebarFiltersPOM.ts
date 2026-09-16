import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import type { OrderStatus } from '../../src/types/database'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar.filters

/** The sidebar's filter panel (inline on desktop, popover in compact mode). */
export class OrderSidebarFiltersPOM extends BasePOM {
  readonly root: Locator
  readonly allStatuses: Locator
  readonly department: Locator
  readonly deadlineFrom: Locator
  readonly deadlineTo: Locator
  readonly intakeFrom: Locator
  readonly intakeTo: Locator
  readonly reset: Locator
  private readonly statuses: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.allStatuses = this.root.getByTestId(IDS.allStatuses)
    this.statuses = this.root.getByTestId(IDS.status)
    this.department = this.root.getByTestId(IDS.department)
    this.deadlineFrom = this.root.getByTestId(IDS.deadlineFrom)
    this.deadlineTo = this.root.getByTestId(IDS.deadlineTo)
    this.intakeFrom = this.root.getByTestId(IDS.intakeFrom)
    this.intakeTo = this.root.getByTestId(IDS.intakeTo)
    this.reset = this.root.getByTestId(IDS.reset)
  }

  status(status: OrderStatus): Locator {
    return this.withAttr(this.statuses, 'data-status', status)
  }
}
