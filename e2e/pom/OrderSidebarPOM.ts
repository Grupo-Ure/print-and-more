import type { Locator, Page } from '@playwright/test'
import type { OrderStatus } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { OrderSidebarFiltersPOM } from './OrderSidebarFiltersPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar

/** Left column of the orders view: search, filters, the order list, "+ New Order". */
export class OrderSidebarPOM extends BasePOM {
  readonly root: Locator
  readonly searchToggle: Locator
  readonly statusFilterToggle: Locator
  readonly departmentFilterToggle: Locator
  readonly deadlineFilterToggle: Locator
  readonly usersFilterToggle: Locator
  readonly searchInput: Locator
  readonly clearSearch: Locator
  readonly filters: OrderSidebarFiltersPOM
  readonly list: Locator
  readonly empty: Locator
  /** Every order row; each carries `data-order-id`, `data-status`, and `aria-current` when selected. */
  readonly rows: Locator
  /** The row of the selected order (the one the details column shows). */
  readonly selectedRow: Locator
  readonly newOrderButton: Locator
  /** Items of the per-row menu (portal — not scoped to the row). */
  readonly rowMenuDuplicate: Locator
  readonly rowMenuDelete: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.searchToggle = this.root.getByTestId(IDS.searchToggle)
    this.statusFilterToggle = this.root.getByTestId(IDS.statusFilterToggle)
    this.departmentFilterToggle = this.root.getByTestId(IDS.departmentFilterToggle)
    this.deadlineFilterToggle = this.root.getByTestId(IDS.deadlineFilterToggle)
    this.usersFilterToggle = this.root.getByTestId(IDS.usersFilterToggle)
    this.searchInput = this.root.getByTestId(IDS.searchInput)
    this.clearSearch = this.root.getByTestId(IDS.clearSearch)
    this.filters = new OrderSidebarFiltersPOM(page)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.list.getByTestId(IDS.empty)
    this.rows = this.list.getByTestId(IDS.row)
    this.selectedRow = this.withAttr(this.rows, 'aria-current', 'true')
    this.newOrderButton = this.root.getByTestId(IDS.newOrderButton)
    this.rowMenuDuplicate = page.getByTestId(IDS.rowMenuDuplicate)
    this.rowMenuDelete = page.getByTestId(IDS.rowMenuDelete)
  }

  row(orderId: string): Locator {
    return this.withAttr(this.rows, 'data-order-id', orderId)
  }

  rowNumber(row: Locator): Locator {
    return row.getByTestId(IDS.rowNumber)
  }

  rowCustomer(row: Locator): Locator {
    return row.getByTestId(IDS.rowCustomer)
  }

  /** Carries `data-status`. */
  rowStatus(row: Locator): Locator {
    return row.getByTestId(IDS.rowStatus)
  }

  rowMenuTrigger(row: Locator): Locator {
    return row.getByTestId(IDS.rowMenuTrigger)
  }

  /**
   * Adds a status the default filter hides (finished, billed) to the list,
   * then closes the status popover again (it floats over the list).
   * Navigation, for a spec's Setup stage.
   */
  async includeStatus(status: OrderStatus): Promise<void> {
    await this.statusFilterToggle.click()
    await this.filters.status.status(status).click()
    await this.statusFilterToggle.click()
  }
}
