import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ProductDialogPOM } from './ProductDialogPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.jobDetail.products

/** The active job's product table plus its add/edit dialog. */
export class ProductSectionPOM extends BasePOM {
  readonly root: Locator
  readonly add: Locator
  readonly table: Locator
  readonly empty: Locator
  /** Every product row; each carries `data-product-id`, `data-type`, and `data-shortage` when stock is short. */
  readonly rows: Locator
  readonly dialog: ProductDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.add = this.root.getByTestId(IDS.add)
    this.table = this.root.getByTestId(IDS.table)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.table.getByTestId(IDS.row)
    this.dialog = new ProductDialogPOM(page)
  }

  row(productId: string): Locator {
    return this.withAttr(this.rows, 'data-product-id', productId)
  }

  rowEdit(row: Locator): Locator {
    return row.getByTestId(IDS.rowEdit)
  }

  rowDelete(row: Locator): Locator {
    return row.getByTestId(IDS.rowDelete)
  }
}
