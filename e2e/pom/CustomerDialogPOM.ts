import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.customerDialog

/** Create / edit a customer (opened from the new-order dialog or the order header). */
export class CustomerDialogPOM extends BasePOM {
  readonly root: Locator
  readonly error: Locator
  readonly name: Locator
  readonly email: Locator
  readonly phone: Locator
  readonly note: Locator
  readonly addressToggle: Locator
  readonly street: Locator
  readonly houseNumber: Locator
  readonly postalCode: Locator
  readonly city: Locator
  /** The notice under the email field while the stored address, which bounced, is still in it. */
  readonly emailBounced: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.error = this.root.getByTestId(IDS.error)
    this.name = this.root.getByTestId(IDS.name)
    this.email = this.root.getByTestId(IDS.email)
    this.phone = this.root.getByTestId(IDS.phone)
    this.note = this.root.getByTestId(IDS.note)
    this.addressToggle = this.root.getByTestId(IDS.addressToggle)
    this.street = this.root.getByTestId(IDS.street)
    this.houseNumber = this.root.getByTestId(IDS.houseNumber)
    this.postalCode = this.root.getByTestId(IDS.postalCode)
    this.city = this.root.getByTestId(IDS.city)
    this.emailBounced = this.root.getByTestId(IDS.emailBounced)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }
}
