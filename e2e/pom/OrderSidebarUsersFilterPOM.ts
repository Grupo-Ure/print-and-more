import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar.filters.users

/** The assignee filter popover ("Unassigned" plus one checkbox per user). */
export class OrderSidebarUsersFilterPOM extends BasePOM {
  readonly root: Locator
  readonly unassigned: Locator
  readonly reset: Locator
  private readonly options: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.unassigned = this.root.getByTestId(IDS.unassigned)
    this.options = this.root.getByTestId(IDS.user)
    this.reset = this.root.getByTestId(IDS.reset)
  }

  user(userId: string): Locator {
    return this.withAttr(this.options, 'data-user-id', userId)
  }
}
