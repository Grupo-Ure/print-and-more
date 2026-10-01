import type { Locator, Page } from '@playwright/test'
import type { ProductStatus } from '../../src/types/database'
import { TEST_IDS } from '../support/testIds'
import { ForceReleaseDialogPOM } from './ForceReleaseDialogPOM'
import { ProductBasicInfoPOM } from './ProductBasicInfoPOM'
import { ProductSettingsPOM } from './ProductSettingsPOM'
import { QuickTimeLogPOM, TimeLogsPOM } from './TimeLogsPOM'
import { OrderFilesPOM } from './OrderFilesPOM'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail

/**
 * The selected product: header (assignee, status, actions, release button),
 * the banner naming what holds it back, and the tabs below it — basic info
 * (the product's own spec form, with the quick-log widget under it), time
 * logs, settings and the order's files. The root carries `data-product-id`,
 * `data-status` and `data-department`.
 *
 * The orders view and the production page both host this component, so both
 * page objects expose the same class.
 */
export class ProductDetailPOM extends BasePOM {
  readonly root: Locator
  readonly title: Locator
  /** Carries `data-value` = assignee user id. */
  readonly assignee: Locator
  /** Shown while a product past setup has nobody assigned. */
  readonly assigneeHint: Locator
  /** Carries `data-status`. */
  readonly status: Locator
  readonly pdfButton: Locator
  readonly deleteButton: Locator
  readonly cancelButton: Locator

  /** The forward workflow action; carries `data-target` = target ProductStatus. */
  readonly releaseButton: Locator
  readonly releaseMenuTrigger: Locator
  readonly forceReleaseItem: Locator
  readonly forceReleaseDialog: ForceReleaseDialogPOM

  /** Carries `data-kind` = done | shortage | blocked | production. */
  readonly banner: Locator
  readonly backToPrepress: Locator

  readonly basicInfoTab: Locator
  readonly timeLogsTab: Locator
  readonly settingsTab: Locator
  readonly filesTab: Locator

  readonly basicInfo: ProductBasicInfoPOM
  /** The quick-log widget below the spec (Basic info tab only, and not once done). */
  readonly quickTimeLog: QuickTimeLogPOM
  readonly timeLogs: TimeLogsPOM
  readonly settings: ProductSettingsPOM
  readonly files: OrderFilesPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.title = this.root.getByTestId(IDS.title)
    this.assignee = this.root.getByTestId(IDS.assignee)
    this.assigneeHint = this.root.getByTestId(IDS.assigneeHint)
    this.status = this.root.getByTestId(IDS.status)
    this.pdfButton = this.root.getByTestId(IDS.pdfButton)
    this.deleteButton = this.root.getByTestId(IDS.deleteButton)
    this.cancelButton = this.root.getByTestId(IDS.cancelButton)

    this.releaseButton = this.root.getByTestId(IDS.release.button)
    this.releaseMenuTrigger = this.root.getByTestId(IDS.release.menuTrigger)
    // Dropdown content is portalled, so not scoped to the root.
    this.forceReleaseItem = page.getByTestId(IDS.release.forceItem)
    this.forceReleaseDialog = new ForceReleaseDialogPOM(page)

    this.banner = this.root.getByTestId(IDS.banner.root)
    this.backToPrepress = this.banner.getByTestId(IDS.banner.backToPrepress)

    this.basicInfoTab = this.root.getByTestId(IDS.tabs.basicInfo)
    this.timeLogsTab = this.root.getByTestId(IDS.tabs.timeLogs)
    this.settingsTab = this.root.getByTestId(IDS.tabs.settings)
    this.filesTab = this.root.getByTestId(IDS.tabs.files)

    this.basicInfo = new ProductBasicInfoPOM(page)
    this.quickTimeLog = new QuickTimeLogPOM(page)
    this.timeLogs = new TimeLogsPOM(page)
    this.settings = new ProductSettingsPOM(page)
    this.files = new OrderFilesPOM(page)
  }

  /** The product detail only while it shows this product. */
  forProduct(productId: string): Locator {
    return this.withAttr(this.root, 'data-product-id', productId)
  }

  /** The release button only while its next step is this status — to wait for the previous step to land. */
  releaseButtonTo(target: ProductStatus): Locator {
    return this.withAttr(this.releaseButton, 'data-target', target)
  }
}
