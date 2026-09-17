/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders → **stock**.
 * Adds the page objects of the two stock pages. Their rows come from the
 * `catalog` fixture in fixtures/orders.ts, which every test already gets.
 */
import { test as base } from './orders'
import { StampStockPOM } from '../pom/StampStockPOM'
import { TextileStockPOM } from '../pom/TextileStockPOM'

type StockViewFixtures = {
  /** The stamp stock page (admins): models with their stock. */
  stampStockPage: StampStockPOM
  /** The textile stock page (admins): variants with their available stock. */
  textileStockPage: TextileStockPOM
}

export const test = base.extend<StockViewFixtures>({
  stampStockPage: async ({ page }, use) => {
    await use(new StampStockPOM(page))
  },

  textileStockPage: async ({ page }, use) => {
    await use(new TextileStockPOM(page))
  },
})

export { expect } from '@playwright/test'
export * from './orders'
