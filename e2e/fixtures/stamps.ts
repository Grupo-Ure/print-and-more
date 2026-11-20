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
 * A booking out of the in-stock model, as `book_stock` takes it: within the
 * model's stock, so only who books it decides whether it goes through.
 */
export const OUTBOUND_BOOKING_OF_IN_STOCK_MODEL = {
  p_kind: 'STAMP',
  p_item_id: IN_STOCK_STAMP_MODEL.id,
  p_type: 'OUTBOUND',
  p_quantity: 1,
  p_note: 'E2E booking by hand',
}
