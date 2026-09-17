import type { Department, JobStatus } from '../../src/types/database'
import type { Database } from '../../src/types/supabase'
import type { ProductSeed } from '../support/database'
import { IN_STOCK_STAMP_MODEL, OUT_OF_STOCK_STAMP_MODEL } from './stamps'
import { IN_STOCK_TEXTILE_CHAIN } from './textiles'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * The department the suite adds jobs to when the department itself is not
 * the point of the test. OTHER has a single product type with two fields and
 * never auto-advances, so a job in it stays in setup while a test builds it.
 */
export const TEST_JOB_DEPARTMENT: Department = 'OTHER'

// ── Statuses ──────────────────────────────────────────────────────────────

/** The status every job starts in. */
export const NEW_JOB_STATUS: JobStatus = 'IN_SETUP'

/** The status a complete job advances to, automatically or by manual release. */
export const PREPRESS_STATUS: JobStatus = 'PREPRESS'

/** The status "Release to Production" moves a job to. */
export const IN_PRODUCTION_STATUS: JobStatus = 'IN_PRODUCTION'

/** The status "Mark job as done" moves a job to; the end of the workflow. */
export const DONE_STATUS: JobStatus = 'DONE'

/**
 * The job number the database assigns to an order's first job in
 * `TEST_JOB_DEPARTMENT`: `<order number>-<department abbreviation>-<01>`.
 */
export function firstTestJobNumber(orderNumber: string): string {
  return `${orderNumber}-OT-01`
}

/**
 * A product of the OTHER department, keyed by form field name — the shape
 * `ProductDialogPOM.fill()` takes.
 */
export const OTHER_PRODUCT = {
  description: 'E2E product',
  quantity: '2',
} as const satisfies Record<string, string>

// ── Force release ─────────────────────────────────────────────────────────

/** What an admin types into the force-release prompt. */
export const FORCE_RELEASE_REASON = 'E2E emergency release'

/** The history entry a force release writes. */
export const FORCE_RELEASE_HISTORY_EVENT: HistoryEvent = 'EMERGENCY_TRIGGERED'

// ── Removal ───────────────────────────────────────────────────────────────

/** The history entry deleting a job (only possible in setup) writes. */
export const JOB_DELETED_HISTORY_EVENT: HistoryEvent = 'JOB_DELETED'

/** The history entry cancelling a job (past setup, kept for history) writes. */
export const JOB_CANCELLED_HISTORY_EVENT: HistoryEvent = 'JOB_CANCELLED'

// ── Rows to insert ────────────────────────────────────────────────────────

/** The same OTHER product, as the rows the `job` fixture inserts. */
export const OTHER_PRODUCT_ROW: ProductSeed = {
  type: 'OTHER',
  quantity: Number(OTHER_PRODUCT.quantity),
  childTable: 'other_products',
  child: { description: OTHER_PRODUCT.description },
}

/** A structured CopyShop product; its job auto-advances to pre-press once complete. */
export const POSTER_PRODUCT_ROW: ProductSeed = {
  type: 'POSTER',
  quantity: 1,
  childTable: 'poster_products',
  child: { format: 'A2', material: '120G_AFFICHEN', laminate: 'NEIN', width: 420, height: 594 },
}

/**
 * A stamp product on the out-of-stock model. `OTHER` as the ink colour means
 * no replacement pad is looked up, so the model is the only stock target.
 */
export const OUT_OF_STOCK_STAMP_PRODUCT_ROW: ProductSeed = {
  type: 'TRODAT_PRINTY',
  quantity: 1,
  childTable: 'trodat_printy_products',
  child: { model_id: OUT_OF_STOCK_STAMP_MODEL.id, color: 'OTHER' },
}

/** The same stamp product on the in-stock model: a release deducts `quantity` from that model. */
export const IN_STOCK_STAMP_PRODUCT_ROW: ProductSeed = {
  ...OUT_OF_STOCK_STAMP_PRODUCT_ROW,
  quantity: 2,
  child: { model_id: IN_STOCK_STAMP_MODEL.id, color: 'OTHER' },
}

/** A garment from own stock on the in-stock variant: a release deducts `quantity` from that variant. */
export const OWN_STOCK_GARMENT_ROW: ProductSeed = {
  type: 'TEXTILE_GARMENT',
  quantity: 2,
  childTable: 'textile_garment_products',
  child: { origin: 'OWN_STOCK', variant_id: IN_STOCK_TEXTILE_CHAIN.variant.id },
}

/**
 * What the `job` fixture inserts: the department, the status, whether the
 * customer has to approve it, and optionally one product.
 *
 * A seed must describe a state the app can reach, since nothing in the
 * database enforces the workflow:
 * - `PREPRESS` and beyond require a complete job: a product here, and the
 *   deadline and delivery from the order — pair these with `IN_PROGRESS_ORDER`.
 * - `IN_PRODUCTION` and `DONE` in the STAMP or TEXTILE departments would also
 *   have booked stock deductions on release; the seeds below stay in OTHER,
 *   which books none.
 */
export type JobSeed = {
  department: Department
  status: JobStatus
  customerApprovalRequired: boolean
  product: ProductSeed | null
}

/** A job with nothing in it — the default. */
export const EMPTY_JOB: JobSeed = {
  department: TEST_JOB_DEPARTMENT,
  status: NEW_JOB_STATUS,
  customerApprovalRequired: false,
  product: null,
}

/** A free-form job with content: complete once the order supplies deadline and delivery, but never auto-advances. */
export const FREE_FORM_JOB_WITH_PRODUCT: JobSeed = { ...EMPTY_JOB, product: OTHER_PRODUCT_ROW }

/** A structured job with content: auto-advances to pre-press once complete. */
export const STRUCTURED_JOB_WITH_PRODUCT: JobSeed = { ...EMPTY_JOB, department: 'COPYSHOP', product: POSTER_PRODUCT_ROW }

/** A structured job without content: held in setup whatever the order supplies. */
export const STRUCTURED_JOB_WITHOUT_PRODUCT: JobSeed = { ...STRUCTURED_JOB_WITH_PRODUCT, product: null }

/** A complete free-form job already released to pre-press. */
export const JOB_IN_PREPRESS: JobSeed = { ...FREE_FORM_JOB_WITH_PRODUCT, status: PREPRESS_STATUS }

/** A complete job in pre-press that the customer still has to approve. */
export const JOB_IN_PREPRESS_AWAITING_APPROVAL: JobSeed = { ...JOB_IN_PREPRESS, customerApprovalRequired: true }

/** A complete stamp job in pre-press whose only stock target is empty. */
export const STAMP_JOB_IN_PREPRESS_OUT_OF_STOCK: JobSeed = {
  ...JOB_IN_PREPRESS,
  department: 'STAMP',
  product: OUT_OF_STOCK_STAMP_PRODUCT_ROW,
}

/** A complete stamp job in pre-press whose model can cover it. */
export const STAMP_JOB_IN_PREPRESS_IN_STOCK: JobSeed = {
  ...STAMP_JOB_IN_PREPRESS_OUT_OF_STOCK,
  product: IN_STOCK_STAMP_PRODUCT_ROW,
}

/** A complete textile job in pre-press whose garment comes from a variant that can cover it. */
export const TEXTILE_JOB_IN_PREPRESS_IN_STOCK: JobSeed = {
  ...JOB_IN_PREPRESS,
  department: 'TEXTILE',
  product: OWN_STOCK_GARMENT_ROW,
}

/** A complete free-form job already in production. */
export const JOB_IN_PRODUCTION: JobSeed = { ...FREE_FORM_JOB_WITH_PRODUCT, status: IN_PRODUCTION_STATUS }

/** A complete free-form job already done — what an order needs before it can be finished. */
export const JOB_DONE: JobSeed = { ...FREE_FORM_JOB_WITH_PRODUCT, status: DONE_STATUS }
