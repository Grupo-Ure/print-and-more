import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.emails.wordingDialog

/**
 * Settings → Emails, *Edit wording*: one mail's subject and body, its
 * placeholders as chips, and the reason a save was refused.
 */
export class EmailWordingDialogPOM extends BasePOM {
  readonly root: Locator
  readonly subject: Locator
  readonly body: Locator
  /** Every placeholder chip; each carries `data-placeholder`. */
  readonly placeholders: Locator
  /** Shown only once a save was refused. */
  readonly error: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.subject = this.root.getByTestId(IDS.subject)
    this.body = this.root.getByTestId(IDS.body)
    this.placeholders = this.root.getByTestId(IDS.placeholder)
    this.error = this.root.getByTestId(IDS.error)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }
}
