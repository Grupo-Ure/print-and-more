import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.settings

/** Per-product overrides of deadline, delivery and priority (the product's Settings tab). */
export class ProductSettingsPOM extends BasePOM {
  readonly root: Locator
  readonly separateDeadline: Locator
  /** Carries `data-value` = ISO date when set. */
  readonly deadline: Locator
  readonly separateDelivery: Locator
  /** Carries `data-value`. */
  readonly delivery: Locator
  readonly separatePriority: Locator
  /** Carries `data-value`. */
  readonly priority: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.separateDeadline = this.root.getByTestId(IDS.separateDeadline)
    this.deadline = this.root.getByTestId(IDS.deadline)
    this.separateDelivery = this.root.getByTestId(IDS.separateDelivery)
    this.delivery = this.root.getByTestId(IDS.delivery)
    this.separatePriority = this.root.getByTestId(IDS.separatePriority)
    this.priority = this.root.getByTestId(IDS.priority)
  }
}
