import type { Locator, Page } from '@playwright/test'

/**
 * Common ancestor of every page object. Holds the page and the locator
 * helpers all page objects share, so none of them imports helpers from
 * outside the class hierarchy.
 */
export abstract class BasePOM {
  protected readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Narrows a repeated-element locator (one test ID shared by every row) to
   * the instance carrying `attr="value"` — e.g. the order row with a given id.
   */
  protected withAttr(locator: Locator, attr: string, value: string): Locator {
    return locator.and(this.page.locator(`[${attr}="${value}"]`))
  }

  /** The opposite: every instance except the one carrying `attr="value"`. */
  protected withoutAttr(locator: Locator, attr: string, value: string): Locator {
    return locator.and(this.page.locator(`:not([${attr}="${value}"])`))
  }
}
