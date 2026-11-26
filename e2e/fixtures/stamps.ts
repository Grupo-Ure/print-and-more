import type { Database } from '../../src/types/supabase'
import type { StampModelSeedRow } from '../support/database'

type HistoryEvent = Database['public']['Enums']['history_event']

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

// ── Booking by hand ───────────────────────────────────────────────────────

/** The history entry a booking by hand writes. */
export const STOCK_BOOKED_HISTORY_EVENT: HistoryEvent = 'STOCK_BOOKED'

/** A booking into the in-stock model, as `book_stock` takes it. */
export const INBOUND_BOOKING_OF_IN_STOCK_MODEL = {
  p_kind: 'STAMP',
  p_item_id: IN_STOCK_STAMP_MODEL.id,
  p_type: 'INBOUND',
  p_quantity: 3,
  p_note: 'E2E delivery',
}

/** What the in-stock model holds once that booking is in. */
export const IN_STOCK_MODEL_STOCK_AFTER_INBOUND = IN_STOCK_STAMP_MODEL.stock + INBOUND_BOOKING_OF_IN_STOCK_MODEL.p_quantity

/** What the entry of that booking records. */
export const INBOUND_BOOKING_ENTRY = {
  direction: INBOUND_BOOKING_OF_IN_STOCK_MODEL.p_type,
  quantity: INBOUND_BOOKING_OF_IN_STOCK_MODEL.p_quantity,
  stock_before: IN_STOCK_STAMP_MODEL.stock,
  stock_after: IN_STOCK_MODEL_STOCK_AFTER_INBOUND,
  note: INBOUND_BOOKING_OF_IN_STOCK_MODEL.p_note,
}

/** A booking out of the in-stock model of one piece more than it holds. */
export const OVERDRAWN_BOOKING_OF_IN_STOCK_MODEL = {
  ...OUTBOUND_BOOKING_OF_IN_STOCK_MODEL,
  p_quantity: IN_STOCK_STAMP_MODEL.stock + 1,
}

/** A stock number other than the in-stock model's own, for a write that goes around the booking. */
export const DIRECT_STOCK_OF_IN_STOCK_MODEL = IN_STOCK_STAMP_MODEL.stock + 1

// ── Booking on the stock page ─────────────────────────────────────────────

/** The pieces an admin books into the in-stock model on the stamp stock page. */
export const STOCK_PAGE_INBOUND_QUANTITY = 2

/** What the in-stock model's row shows once they are in. */
export const IN_STOCK_MODEL_STOCK_AFTER_PAGE_BOOKING = IN_STOCK_STAMP_MODEL.stock + STOCK_PAGE_INBOUND_QUANTITY

/** What the entry of that booking records of its direction and quantity. */
export const STOCK_PAGE_INBOUND_ENTRY = { direction: 'INBOUND', quantity: STOCK_PAGE_INBOUND_QUANTITY }
