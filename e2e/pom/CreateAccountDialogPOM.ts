import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'

const IDS = TEST_IDS.userManagement.createDialog

/** Super-admin: create a login with an initial password and role. */
export class CreateAccountDialogPOM {
  readonly root: Locator
  readonly name: Locator
  readonly email: Locator
  readonly password: Locator
  /** Carries `data-value` = selected role. */
  readonly role: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    this.root = page.getByTestId(IDS.root)
    this.name = this.root.getByTestId(IDS.name)
    this.email = this.root.getByTestId(IDS.email)
    this.password = this.root.getByTestId(IDS.password)
    this.role = this.root.getByTestId(IDS.role)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }
}
