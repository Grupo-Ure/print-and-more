import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ApprovalAnswerDialogPOM } from './ApprovalAnswerDialogPOM'
import { ApprovalRequestDialogPOM } from './ApprovalRequestDialogPOM'
import { ApprovalRequestsPOM } from './ApprovalRequestsPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.files

/**
 * The product's Files tab (UNC paths; nothing is uploaded): the product's own
 * files, with the approval request and its rounds, or the whole order's. The
 * root carries `data-scope` = product | order.
 */
export class OrderFilesPOM extends BasePOM {
  readonly root: Locator
  /** The product's own files — the default. */
  readonly productScope: Locator
  /** The whole order's files. */
  readonly orderScope: Locator
  readonly addFiles: Locator
  readonly error: Locator
  readonly list: Locator
  /** Every linked file; each carries `data-file-id`. */
  readonly items: Locator
  /** Product scope only. */
  readonly requestApproval: Locator
  readonly requests: ApprovalRequestsPOM
  readonly requestDialog: ApprovalRequestDialogPOM
  readonly answerDialog: ApprovalAnswerDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.productScope = this.withAttr(this.root.getByTestId(IDS.scope), 'data-scope', 'product')
    this.orderScope = this.withAttr(this.root.getByTestId(IDS.scope), 'data-scope', 'order')
    this.addFiles = this.root.getByTestId(IDS.addFiles)
    this.error = this.root.getByTestId(IDS.error)
    this.list = this.root.getByTestId(IDS.list)
    this.items = this.list.getByTestId(IDS.item)
    this.requestApproval = this.root.getByTestId(IDS.requestApproval)
    this.requests = new ApprovalRequestsPOM(page)
    this.requestDialog = new ApprovalRequestDialogPOM(page)
    this.answerDialog = new ApprovalAnswerDialogPOM(page)
  }

  /** The tab only while it shows this scope — to wait for a switch to land. */
  inScope(scope: 'product' | 'order'): Locator {
    return this.withAttr(this.root, 'data-scope', scope)
  }

  item(fileId: string): Locator {
    return this.withAttr(this.items, 'data-file-id', fileId)
  }

  /** The row's checkbox (product scope). */
  itemSelect(item: Locator): Locator {
    return item.getByTestId(IDS.itemSelect)
  }

  /** The display name — a static span, or an input while `itemEditName` is active. */
  itemName(item: Locator): Locator {
    return item.getByTestId(IDS.itemName)
  }

  /** The pencil button that switches the name to its input. */
  itemEditName(item: Locator): Locator {
    return item.getByTestId(IDS.itemEditName)
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
