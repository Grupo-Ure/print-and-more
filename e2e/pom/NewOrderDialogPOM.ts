import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.newOrderDialog

/** "+ New Order": pick or create a customer, then create the quote. */
export class NewOrderDialogPOM extends BasePOM {
  readonly root: Locator
  readonly error: Locator
  readonly customerSearch: Locator
  /** Every search result; each carries `data-customer-id`. */
  readonly customerOptions: Locator
  readonly newCustomer: Locator
  /** The chosen customer card; carries `data-customer-id`. */
  readonly selectedCustomer: Locator
  readonly editCustomer: Locator
  readonly changeCustomer: Locator
  readonly cancel: Locator
  readonly submit: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.error = this.root.getByTestId(IDS.error)
    this.customerSearch = this.root.getByTestId(IDS.customerSearch)
    this.customerOptions = this.root.getByTestId(IDS.customerOption)
    this.newCustomer = this.root.getByTestId(IDS.newCustomer)
    this.selectedCustomer = this.root.getByTestId(IDS.selectedCustomer)
    this.editCustomer = this.root.getByTestId(IDS.editCustomer)
    this.changeCustomer = this.root.getByTestId(IDS.changeCustomer)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.submit = this.root.getByTestId(IDS.submit)
  }

  customerOption(customerId: string): Locator {
    return this.withAttr(this.customerOptions, 'data-customer-id', customerId)
  }
}
