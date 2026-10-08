import type { Department, ProductStatus } from '../../src/types/database'
import type { Database } from '../../src/types/supabase'
import type { ChildTable } from '../../src/types/product'
import type { ProductSeed } from '../support/database'
import { IN_STOCK_STAMP_MODEL, OUT_OF_STOCK_STAMP_MODEL } from './stamps'
import { IN_STOCK_TEXTILE_CHAIN } from './textiles'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * The department the suite adds products to when the department itself is not
 * the point of the test. OTHER has a single product type with two fields, so a
 * test builds a product in it with the fewest inputs — and with nothing to pick,
 * its add button starts the draft straight away instead of offering a type menu.
 */
export const TEST_PRODUCT_DEPARTMENT: Department = 'OTHER'

/** The typed child table of the one product type in `TEST_PRODUCT_DEPARTMENT`. */
export const TEST_PRODUCT_CHILD_TABLE = 'other_products' as const satisfies ChildTable

// ── Statuses ──────────────────────────────────────────────────────────────

/** The status every product starts in. */
export const NEW_PRODUCT_STATUS: ProductStatus = 'IN_SETUP'

/** The status a complete product advances to, automatically or by manual release. */
export const PREPRESS_STATUS: ProductStatus = 'PREPRESS'

/** The status "Release to Production" moves a product to. */
export const IN_PRODUCTION_STATUS: ProductStatus = 'IN_PRODUCTION'

/** The status "Mark product as done" moves a product to; the end of the workflow. */
export const DONE_STATUS: ProductStatus = 'DONE'

/**
 * The product number the database assigns to an order's first product in
 * `TEST_PRODUCT_DEPARTMENT`: `<order number>-<department abbreviation>-<01>`.
 */
export function firstTestProductNumber(orderNumber: string): string {
  return `${orderNumber}-OT-01`
}

/**
 * An OTHER product keyed by form field name — the shape a spec fills the draft
 * panel and the Basic info tab with (both render the same per-type form).
 */
export const OTHER_PRODUCT_FORM = {
  description: 'E2E product',
  quantity: '2',
} as const satisfies Record<string, string>

/** A second description, for an edit that has to differ from what was saved. */
export const EDITED_OTHER_DESCRIPTION = 'E2E product, revised'

/** A second quantity, for an edit of the parent's spec columns that has to differ from what was saved. */
export const EDITED_OTHER_QUANTITY = Number(OTHER_PRODUCT_FORM.quantity) + 1

/**
 * The SQLSTATE a trigger's RAISE EXCEPTION arrives as (`raise_exception`) —
 * what the database answers when a released product's spec is written to
 * (trg_refuse_released_product_spec_change and its child-table twin).
 */
export const RELEASED_SPEC_LOCKED_ERROR_CODE = 'P0001'

// ── Force release ─────────────────────────────────────────────────────────

/** What an admin types into the force-release prompt. */
export const FORCE_RELEASE_REASON = 'E2E emergency release'

/** The history entry a force release writes. */
export const FORCE_RELEASE_HISTORY_EVENT: HistoryEvent = 'EMERGENCY_TRIGGERED'

// ── Removal ───────────────────────────────────────────────────────────────

/** The history entry deleting a product (only possible in setup) writes. */
export const PRODUCT_DELETED_HISTORY_EVENT: HistoryEvent = 'PRODUCT_DELETED'

/** The history entry cancelling a product (past setup, kept for history) writes. */
export const PRODUCT_CANCELLED_HISTORY_EVENT: HistoryEvent = 'PRODUCT_CANCELLED'

// ── Rows to insert ────────────────────────────────────────────────────────
//
// A product is the unit of work, so a seed describes the whole of it: the
// parent columns (department, type, status, approval flag) and the children
// that hold its spec. The seed must describe a state the app can reach, since
// nothing in the database enforces the workflow:
// - `PREPRESS` and beyond need a complete product, which now means an
//   effective deadline — pair these with `IN_PROGRESS_ORDER`, whose deadline
//   every product inherits.
// - `IN_PRODUCTION` and `DONE` in the STAMP or TEXTILE departments would also
//   have booked stock deductions on release; the general-purpose seeds stay in
//   OTHER, which books none.
// - A released product's spec is locked by the database for the app, not for
//   the runner: its service-role connection is exempt, so a seed in
//   `IN_PRODUCTION` or `DONE` still inserts its child rows.

/** The same OTHER product as `OTHER_PRODUCT_FORM`, as the row the fixture inserts. */
export const OTHER_PRODUCT: ProductSeed = {
  department: TEST_PRODUCT_DEPARTMENT,
  type: 'OTHER',
  status: NEW_PRODUCT_STATUS,
  quantity: Number(OTHER_PRODUCT_FORM.quantity),
  customer_approval_required: false,
  childTable: TEST_PRODUCT_CHILD_TABLE,
  child: { description: OTHER_PRODUCT_FORM.description },
}

/** A CopyShop product. */
export const POSTER_PRODUCT: ProductSeed = {
  ...OTHER_PRODUCT,
  department: 'COPYSHOP',
  type: 'POSTER',
  quantity: 1,
  childTable: 'poster_products',
  child: { format: 'A2', material: '120G_AFFICHEN', laminate: 'NEIN', width: 420, height: 594 },
}

/** A large-format product. */
export const BANNER_PRODUCT: ProductSeed = {
  ...OTHER_PRODUCT,
  department: 'LFP',
  type: 'BANNER',
  quantity: 1,
  childTable: 'banner_products',
  child: { material: 'PVC_FRONTLIT', width: 2000, height: 1000, hem: true, eyelets: false },
}

/** A laser-engraving product. */
export const SIGN_PRODUCT: ProductSeed = {
  ...OTHER_PRODUCT,
  department: 'LASER_ENGRAVING',
  type: 'SIGN',
  quantity: 1,
  childTable: 'sign_products',
  child: { material: 'ABS_SW', width: 100, height: 50, round_corners: false, self_adhesive: true, motif: 'E2E motif' },
}

/**
 * A stamp product on the out-of-stock model. `OTHER` as the ink colour means
 * no replacement pad is looked up, so the model is the only stock target.
 */
export const OUT_OF_STOCK_STAMP_PRODUCT: ProductSeed = {
  ...OTHER_PRODUCT,
  department: 'STAMP',
  type: 'TRODAT_PRINTY',
  quantity: 1,
  childTable: 'trodat_printy_products',
  child: { model_id: OUT_OF_STOCK_STAMP_MODEL.id, color: 'OTHER' },
}

/** The same stamp product on the in-stock model: a release deducts `quantity` from that model. */
export const IN_STOCK_STAMP_PRODUCT: ProductSeed = {
  ...OUT_OF_STOCK_STAMP_PRODUCT,
  quantity: 2,
  childTable: 'trodat_printy_products',
  child: { model_id: IN_STOCK_STAMP_MODEL.id, color: 'OTHER' },
}

/** The pieces the textile batch below orders of its one catalog variant. */
export const TEXTILE_GARMENT_QUANTITY = 2

/**
 * A textile batch with one shop-supplied garment line on the in-stock variant:
 * a release deducts the line's own quantity from that variant. The batch's
 * parent `quantity` is null — the pieces are counted on the lines.
 */
export const SHOP_SUPPLIED_TEXTILE_BATCH: ProductSeed = {
  department: 'TEXTILE',
  type: 'TEXTILE_GARMENT',
  status: NEW_PRODUCT_STATUS,
  quantity: null,
  customer_approval_required: false,
  garments: [
    {
      origin: 'SHOP_SUPPLIED',
      variant_id: IN_STOCK_TEXTILE_CHAIN.variant.id,
      size: IN_STOCK_TEXTILE_CHAIN.variant.size,
      color: IN_STOCK_TEXTILE_CHAIN.variant.color,
      quantity: TEXTILE_GARMENT_QUANTITY,
    },
  ],
  designs: [],
}

/** All six departments at once, for an order that has work in every one of them. */
export const ONE_PRODUCT_PER_DEPARTMENT: readonly ProductSeed[] = [
  BANNER_PRODUCT,
  POSTER_PRODUCT,
  SHOP_SUPPLIED_TEXTILE_BATCH,
  IN_STOCK_STAMP_PRODUCT,
  SIGN_PRODUCT,
  OTHER_PRODUCT,
]

/** A product already in pre-press. */
export const PRODUCT_IN_PREPRESS: ProductSeed = { ...OTHER_PRODUCT, status: PREPRESS_STATUS }

/** A product in pre-press that the customer still has to approve. */
export const PRODUCT_IN_PREPRESS_AWAITING_APPROVAL: ProductSeed = {
  ...PRODUCT_IN_PREPRESS,
  customer_approval_required: true,
}

/** A stamp product in pre-press whose only stock target is empty. */
export const STAMP_PRODUCT_IN_PREPRESS_OUT_OF_STOCK: ProductSeed = {
  ...OUT_OF_STOCK_STAMP_PRODUCT,
  status: PREPRESS_STATUS,
}

/** A stamp product in pre-press whose model can cover it. */
export const STAMP_PRODUCT_IN_PREPRESS_IN_STOCK: ProductSeed = {
  ...IN_STOCK_STAMP_PRODUCT,
  status: PREPRESS_STATUS,
}

/** A textile batch in pre-press whose garment line sits on a variant that can cover it. */
export const TEXTILE_BATCH_IN_PREPRESS_IN_STOCK: ProductSeed = {
  ...SHOP_SUPPLIED_TEXTILE_BATCH,
  status: PREPRESS_STATUS,
}

/** A product already in production. */
export const PRODUCT_IN_PRODUCTION: ProductSeed = { ...OTHER_PRODUCT, status: IN_PRODUCTION_STATUS }

/** A product already done — what an order needs before it can be finished. */
export const PRODUCT_DONE: ProductSeed = { ...OTHER_PRODUCT, status: DONE_STATUS }
