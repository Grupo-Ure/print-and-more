import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.approval

/**
 * Settings → Customer approval: two number fields (`customer_approval_settings`), each
 * saving when it is left.
 */
export class ApprovalSettingsPOM extends BasePOM {
  readonly root: Locator
  /** Days an approval link stays valid; `data-value` = the stored value, empty while loading. */
  readonly expiryDays: Locator
  /** Days proof copies are kept after billing; `data-value` = the stored value, empty while loading. */
  readonly retentionDays: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.expiryDays = this.root.getByTestId(IDS.expiryDays)
    this.retentionDays = this.root.getByTestId(IDS.retentionDays)
  }

  /** A field once the database holds that value — a draft being typed does not match. */
  stored(field: Locator, value: number): Locator {
    return this.withAttr(field, 'data-value', String(value))
  }
}
