import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

/** Mirrors `ToastType` in src/components/Toast.tsx (a .tsx module the e2e tsconfig can't import). */
export type ToastType = 'error' | 'success' | 'info'

const IDS = TEST_IDS.toast

/** The toast stack in the top-right corner. */
export class ToastPOM extends BasePOM {
  readonly container: Locator
  /** Every visible toast; each carries `data-type`. */
  readonly items: Locator

  constructor(page: Page) {
    super(page)
    this.container = page.getByTestId(IDS.container)
    this.items = this.container.getByTestId(IDS.item)
  }

  ofType(type: ToastType): Locator {
    return this.withAttr(this.items, 'data-type', type)
  }

  closeButton(toast: Locator): Locator {
    return toast.getByTestId(IDS.close)
  }
}
