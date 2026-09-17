import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { OrderSidebarFiltersPOM } from './OrderSidebarFiltersPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.sidebar

/** Left column of the orders view: search, filters, the order list, "+ New Order". */
export class OrderSidebarPOM extends BasePOM {
  readonly root: Locator
  readonly searchToggle: Locator
  readonly filterToggle: Locator
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
    this.filterToggle = this.root.getByTestId(IDS.filterToggle)
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
}
