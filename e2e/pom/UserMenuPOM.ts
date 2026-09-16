import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.navbar.userMenu

/** The navbar's account menu: trigger plus the dropdown it opens. */
export class UserMenuPOM extends BasePOM {
  /** Carries `data-user-email` of the signed-in user. */
  readonly trigger: Locator
  readonly content: Locator
  readonly name: Locator
  readonly email: Locator
  /** Carries `data-role`. */
  readonly role: Locator
  readonly profile: Locator
  readonly signOut: Locator

  constructor(page: Page) {
    super(page)
    this.trigger = page.getByTestId(IDS.trigger)
    this.content = page.getByTestId(IDS.content)
    this.name = this.content.getByTestId(IDS.name)
    this.email = this.content.getByTestId(IDS.email)
    this.role = this.content.getByTestId(IDS.role)
    this.profile = this.content.getByTestId(IDS.profile)
    this.signOut = this.content.getByTestId(IDS.signOut)
  }

  /** The trigger, but only while this user is the one signed in. */
  signedInAs(email: string): Locator {
    return this.withAttr(this.trigger, 'data-user-email', email)
  }

  async open(): Promise<void> {
    await this.trigger.click()
  }
}
