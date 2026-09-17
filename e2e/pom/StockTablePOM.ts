import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.stock

/** Per-row stock booking controls. */
export type BookingField = {
  quantity: Locator
  increase: Locator
  decrease: Locator
  error: Locator
}

/** The sortable stock table shared by the stamp and textile pages. */
export class StockTablePOM extends BasePOM {
  readonly root: Locator
  readonly empty: Locator
  /** Every row; each carries `data-row-id` (stamp model id / textile variant id). */
  readonly rows: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.table.root)
    this.empty = this.root.getByTestId(IDS.table.empty)
    this.rows = this.root.getByTestId(IDS.table.row)
  }

  row(rowId: string): Locator {
    return this.withAttr(this.rows, 'data-row-id', rowId)
  }

  /** The row's stock figure; carries `data-stock`. */
  rowStock(row: Locator): Locator {
    return row.getByTestId(IDS.table.rowStock)
  }

  booking(row: Locator): BookingField {
    return {
      quantity: row.getByTestId(IDS.booking.quantity),
      increase: row.getByTestId(IDS.booking.increase),
      decrease: row.getByTestId(IDS.booking.decrease),
      error: row.getByTestId(IDS.booking.error),
    }
  }
}
