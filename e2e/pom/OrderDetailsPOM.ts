import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { JobListPOM } from './JobListPOM'
import { JobDetailPOM } from './JobDetailPOM'
import { OrderFilesDialogPOM } from './OrderFilesDialogPOM'
import { OrderHistoryDialogPOM } from './OrderHistoryDialogPOM'
import { DeadlinePickerPOM } from './DeadlinePickerPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.details

/**
 * Centre column with an order selected: header, settings row, job list and
 * the active job. The root carries `data-order-id`, `data-customer-id` and
 * `data-status`.
 */
export class OrderDetailsPOM extends BasePOM {
  readonly root: Locator

  // Header
  readonly orderNumber: Locator
  readonly totalTime: Locator
  readonly quoteNotice: Locator
  readonly doneNotice: Locator
  readonly reopen: Locator
  /** The single forward action; carries `data-target` = target OrderStatus. */
  readonly lifecycle: Locator
  readonly filesButton: Locator
  readonly historyButton: Locator
  readonly archive: Locator
  readonly cancel: Locator
  readonly customerName: Locator
  readonly editCustomer: Locator
  readonly customerEmail: Locator
  readonly customerPhone: Locator
  readonly customerAddress: Locator
  readonly copyOrderNumber: Locator

  // Settings row — each carries `data-value` with the current selection.
  readonly deadline: DeadlinePickerPOM
  readonly delivery: Locator
  readonly priority: Locator
  readonly payment: Locator

  readonly jobList: JobListPOM
  readonly jobDetail: JobDetailPOM
  readonly filesDialog: OrderFilesDialogPOM
  readonly historyDialog: OrderHistoryDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)

    const h = IDS.header
    this.orderNumber = this.root.getByTestId(h.orderNumber)
    this.totalTime = this.root.getByTestId(h.totalTime)
    this.quoteNotice = this.root.getByTestId(h.quoteNotice)
    this.doneNotice = this.root.getByTestId(h.doneNotice)
    this.reopen = this.root.getByTestId(h.reopen)
    this.lifecycle = this.root.getByTestId(h.lifecycle)
    this.filesButton = this.root.getByTestId(h.files)
    this.historyButton = this.root.getByTestId(h.history)
    this.archive = this.root.getByTestId(h.archive)
    this.cancel = this.root.getByTestId(h.cancel)
    this.customerName = this.root.getByTestId(h.customerName)
    this.editCustomer = this.root.getByTestId(h.editCustomer)
    this.customerEmail = this.root.getByTestId(h.customerEmail)
    this.customerPhone = this.root.getByTestId(h.customerPhone)
    this.customerAddress = this.root.getByTestId(h.customerAddress)
    this.copyOrderNumber = this.root.getByTestId(h.copyOrderNumber)

    const s = IDS.settings
    const settings = this.root.getByTestId(s.root)
    this.deadline = new DeadlinePickerPOM(page, { trigger: s.deadline, calendar: s.deadlineCalendar })
    this.delivery = settings.getByTestId(s.delivery)
    this.priority = settings.getByTestId(s.priority)
    this.payment = settings.getByTestId(s.payment)

    this.jobList = new JobListPOM(page)
    this.jobDetail = new JobDetailPOM(page)
    this.filesDialog = new OrderFilesDialogPOM(page)
    this.historyDialog = new OrderHistoryDialogPOM(page)
  }

  /** The details column only while it shows this order. */
  forOrder(orderId: string): Locator {
    return this.withAttr(this.root, 'data-order-id', orderId)
  }

  /** The details column only while it shows an order other than this one — e.g. a copy whose id the spec cannot know. */
  forOrderOtherThan(orderId: string): Locator {
    return this.withoutAttr(this.root, 'data-order-id', orderId)
  }
}
