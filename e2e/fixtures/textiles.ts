import type { TextileChainSeed } from '../support/database'

/**
 * The textile master data the suite keeps in the catalog: one brand, one
 * product, one variant in stock. Ids are fixed so a product seed can
 * reference the variant before the rows exist; the `catalog` fixture (see
 * fixtures/orders.ts) inserts the chain before every test, which also
 * resets the variant's stock, and removes it afterwards.
 */
export const IN_STOCK_TEXTILE_CHAIN: TextileChainSeed = {
  brand: { id: '00000000-0000-4000-8000-0000000e2e11', name: 'E2E Brand' },
  product: { id: '00000000-0000-4000-8000-0000000e2e12', brand_id: '00000000-0000-4000-8000-0000000e2e11', name: 'E2E Shirt' },
  variant: {
    id: '00000000-0000-4000-8000-0000000e2e13',
    product_id: '00000000-0000-4000-8000-0000000e2e12',
    color: 'Black',
    size: 'M',
    stock: 5,
  },
}
