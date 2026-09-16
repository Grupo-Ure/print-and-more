import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.details.filesDialog

/** Order-level file links (UNC paths; nothing is uploaded). */
export class OrderFilesDialogPOM extends BasePOM {
  readonly root: Locator
  readonly addFiles: Locator
  readonly error: Locator
  readonly list: Locator
  /** Every linked file; each carries `data-file-id`. */
  readonly items: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.addFiles = this.root.getByTestId(IDS.addFiles)
    this.error = this.root.getByTestId(IDS.error)
    this.list = this.root.getByTestId(IDS.list)
    this.items = this.list.getByTestId(IDS.item)
  }

  item(fileId: string): Locator {
    return this.withAttr(this.items, 'data-file-id', fileId)
  }

  itemName(item: Locator): Locator {
    return item.getByTestId(IDS.itemName)
  }

  /** Carries `data-value` = file role. */
  itemRole(item: Locator): Locator {
    return item.getByTestId(IDS.itemRole)
  }

  itemRemove(item: Locator): Locator {
    return item.getByTestId(IDS.itemRemove)
  }

  itemPath(item: Locator): Locator {
    return item.getByTestId(IDS.itemPath)
  }
}
