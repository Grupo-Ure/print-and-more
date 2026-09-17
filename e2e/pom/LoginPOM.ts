import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import type { TestUser } from '../fixtures/users'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.login

/** The sign-in screen shown while no session exists. */
export class LoginPOM extends BasePOM {
  readonly root: Locator
  readonly email: Locator
  readonly password: Locator
  readonly submit: Locator
  readonly google: Locator
  readonly error: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.email = this.root.getByTestId(IDS.email)
    this.password = this.root.getByTestId(IDS.password)
    this.submit = this.root.getByTestId(IDS.submit)
    this.google = this.root.getByTestId(IDS.google)
    this.error = this.root.getByTestId(IDS.error)
  }

  /** Fills the form and submits; does not wait for the outcome. */
  async signIn(user: TestUser): Promise<void> {
    await this.email.fill(user.email)
    await this.password.fill(user.password)
    await this.submit.click()
  }
}
