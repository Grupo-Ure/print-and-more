/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * **production**. Adds the Production page's page object (`productionPage`).
 * The products it lists come from the orders view's data fixtures (`order`,
 * `product`, `products`), which is why this link sits above `orders`.
 */
import { test as base } from './orders'
import { ProductionPOM } from '../pom/ProductionPOM'

type ProductionViewFixtures = {
  /** The Production page — the cross-order product feed. */
  productionPage: ProductionPOM
}

export const test = base.extend<ProductionViewFixtures>({
  productionPage: async ({ page }, use) => {
    await use(new ProductionPOM(page))
  },
})

export { expect } from '@playwright/test'
