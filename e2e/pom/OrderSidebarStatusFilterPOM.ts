import type { Locator, Page } from '@playwright/test'
import type { OrderStatus } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar.filters.status

/** The status filter popover. */
export class OrderSidebarStatusFilterPOM extends BasePOM {
  readonly root: Locator
  readonly allStatuses: Locator
  readonly reset: Locator
  private readonly statuses: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.allStatuses = this.root.getByTestId(IDS.allStatuses)
    this.statuses = this.root.getByTestId(IDS.status)
    this.reset = this.root.getByTestId(IDS.reset)
  }

  status(status: OrderStatus): Locator {
    return this.withAttr(this.statuses, 'data-status', status)
  }
}
