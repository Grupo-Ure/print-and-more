import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.accessDenied

/** Full-page notice on role-gated views (stock pages, user management). */
export class AccessDeniedPOM {
  readonly root: Locator
  readonly backToOrders: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.backToOrders = this.root.getByTestId(IDS.backToOrders)
  }
}
