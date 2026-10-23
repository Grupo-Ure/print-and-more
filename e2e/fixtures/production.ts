/**
 * Fixture chain: `@playwright/test` → database → electron → auth → orders →
 * emails → approvals → **production**. Adds the Production page's page object
 * (`productionPage`). The products it lists come from the orders view's data
 * fixtures (`order`, `product`, `products`), and a product waiting for the
 * customer from the approvals' `approvalRequest`, which is why this link sits
 * above both.
 */
import { test as base } from './approvals'
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
