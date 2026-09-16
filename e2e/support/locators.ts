import type { Locator } from '@playwright/test'

/**
 * Narrows a repeated-element locator (one test ID shared by every row) to the
 * instance carrying `attr="value"` — e.g. the order row with a given id.
 */
export function withAttr(locator: Locator, attr: string, value: string): Locator {
  return locator.and(locator.page().locator(`[${attr}="${value}"]`))
}
