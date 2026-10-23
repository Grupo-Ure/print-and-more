import type { StampModelSeedRow } from '../support/database'

/**
 * The stamp models the suite keeps in the catalog. Their ids are fixed so a
 * product seed can reference them before the rows exist; the `catalog`
 * fixture (see fixtures/orders.ts) inserts them before every test, which
 * also resets their stock, and removes them afterwards.
 */

/** Out of stock, for the stock gate. */
export const OUT_OF_STOCK_STAMP_MODEL: StampModelSeedRow = {
  id: '00000000-0000-4000-8000-0000000e2e01',
  name: 'E2E Trodat Printy (out of stock)',
  type: 'TRODAT_PRINTY',
  stock: 0,
}

/** In stock, for the deduction on release. */
export const IN_STOCK_STAMP_MODEL: StampModelSeedRow = {
  id: '00000000-0000-4000-8000-0000000e2e02',
  name: 'E2E Trodat Printy (in stock)',
  type: 'TRODAT_PRINTY',
  stock: 5,
}

/**
 * A deduction one past the in-stock model's stock, as the jsonb list
 * `book_production_deductions` takes: with the shortage allowed it would
 * empty the model.
 */
export const DEDUCTION_PAST_IN_STOCK_MODEL = [
  { target: 'STAMP', id: IN_STOCK_STAMP_MODEL.id, quantity: IN_STOCK_STAMP_MODEL.stock + 1 },
]

/** The note a hand-made booking carries. */
export const MANUAL_DEDUCTION_NOTE = 'E2E booking by hand'
