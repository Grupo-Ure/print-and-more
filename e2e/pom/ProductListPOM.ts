import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ProductContextMenuPOM } from './ProductContextMenuPOM'
import type { Department, ProductStatus } from '../../src/types/database'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productList

/**
 * The product column: one add-product button per department (each offering that
 * department's product types) and a row per product, plus the dashed row of the
 * product being added.
 */
export class ProductListPOM extends BasePOM {
  readonly root: Locator
  readonly list: Locator
  readonly empty: Locator
  /** Every product row; each carries `data-product-id`, `data-status`, and `aria-current` when selected. */
  readonly rows: Locator
  /** The row of the active product (the one `ProductDetail` shows). */
  readonly selectedRow: Locator
  /** The unsaved product's row; `data-department`, `data-type`. */
  readonly draftRow: Locator
  readonly contextMenu: ProductContextMenuPOM
  private readonly addProductButtons: Locator
  private readonly addProductTypes: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.addProductButtons = this.root.getByTestId(IDS.addProduct)
    // The type menu is portalled out of the list, so it is located on the page.
    this.addProductTypes = page.getByTestId(IDS.addProductType)
    this.list = this.root.getByTestId(IDS.list)
    this.empty = this.root.getByTestId(IDS.empty)
    this.rows = this.list.getByTestId(IDS.row)
    this.selectedRow = this.withAttr(this.rows, 'aria-current', 'true')
    this.draftRow = this.list.getByTestId(IDS.draftRow)
    this.contextMenu = new ProductContextMenuPOM(page)
  }

  /**
   * The department's add button: it opens that department's type menu, or starts
   * the draft directly when the department offers a single type.
   */
  addProduct(department: Department): Locator {
    return this.withAttr(this.addProductButtons, 'data-department', department)
  }

  /** A product type in the open department menu. */
  addProductType(type: string): Locator {
    return this.withAttr(this.addProductTypes, 'data-type', type)
  }

  row(productId: string): Locator {
    return this.withAttr(this.rows, 'data-product-id', productId)
  }

  /** The product's row only while it is in this status — to wait for a transition to land. */
  rowInStatus(productId: string, status: ProductStatus): Locator {
    return this.withAttr(this.row(productId), 'data-status', status)
  }

  rowMissingInfo(row: Locator): Locator {
    return row.getByTestId(IDS.rowMissingInfo)
  }

  /** The status every listed product is in, keyed by product id — a read for `expect.poll`. */
  async rowStatuses(): Promise<Record<string, ProductStatus | null>> {
    return this.rows.evaluateAll(elements =>
      Object.fromEntries(
        elements.map(element => [element.getAttribute('data-product-id'), element.getAttribute('data-status')]),
      ),
    )
  }
}
