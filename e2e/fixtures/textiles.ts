import type { TextileChainSeed } from '../support/database'

/**
 * The textile master data the suite keeps in the catalog: one brand, one
 * model, one variant in stock. Ids are fixed so a garment line can reference
 * the variant before the rows exist; the `catalog` fixture (see
 * fixtures/orders.ts) inserts the chain before every test, which also resets
 * the variant's stock, and removes it afterwards.
 */
export const IN_STOCK_TEXTILE_CHAIN: TextileChainSeed = {
  brand: { id: '00000000-0000-4000-8000-0000000e2e11', name: 'E2E Brand' },
  model: { id: '00000000-0000-4000-8000-0000000e2e12', brand_id: '00000000-0000-4000-8000-0000000e2e11', name: 'E2E Shirt' },
  variant: {
    id: '00000000-0000-4000-8000-0000000e2e13',
    model_id: '00000000-0000-4000-8000-0000000e2e12',
    color: 'Black',
    size: 'M',
    stock: 5,
  },
}

/**
 * A brand the catalog does not hold — what an employee would try to add to
 * the stock master data. Its id is fixed so the test can remove it should the
 * insert ever go through.
 */
export const NEW_TEXTILE_BRAND = { id: '00000000-0000-4000-8000-0000000e2e21', name: 'E2E Brand, added by an employee' }
