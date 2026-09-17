import type { StampModelSeedRow } from '../support/database'

/**
 * A stamp model that is out of stock, for the stock gate. The id is fixed so
 * a product seed can reference it before the row exists; the `stampModel`
 * fixture (see fixtures/orders.ts) inserts it once per worker and removes it
 * at the end.
 */
export const OUT_OF_STOCK_STAMP_MODEL: StampModelSeedRow = {
  id: '00000000-0000-4000-8000-0000000e2e01',
  name: 'E2E Trodat Printy (out of stock)',
  type: 'TRODAT_PRINTY',
  stock: 0,
}
