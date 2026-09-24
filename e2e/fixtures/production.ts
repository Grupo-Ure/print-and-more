/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * **production**. Adds the Production page's page object (`productionPage`).
 * The jobs it lists come from the orders view's data fixtures (`order`,
 * `job`, `jobs`), which is why this link sits above `orders`.
 */
import { test as base } from './orders'
import { ProductionPOM } from '../pom/ProductionPOM'

type ProductionViewFixtures = {
  /** The Production page — the cross-order job feed. */
  productionPage: ProductionPOM
}

export const test = base.extend<ProductionViewFixtures>({
  productionPage: async ({ page }, use) => {
    await use(new ProductionPOM(page))
  },
})

export { expect } from '@playwright/test'
