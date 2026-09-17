import type { Department, JobStatus } from '../../src/types/database'
import type { ProductSeed } from '../support/database'

/**
 * The department the suite adds jobs to when the department itself is not
 * the point of the test. OTHER has a single product type with two fields and
 * never auto-advances, so a job in it stays in setup while a test builds it.
 */
export const TEST_JOB_DEPARTMENT: Department = 'OTHER'

/** The status every job starts in. */
export const NEW_JOB_STATUS: JobStatus = 'IN_SETUP'

/** The status a complete job advances to, automatically or by manual release. */
export const PREPRESS_STATUS: JobStatus = 'PREPRESS'

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

// ── Rows to insert ────────────────────────────────────────────────────────

/** The same OTHER product, as the rows the `job` fixture inserts. */
export const OTHER_PRODUCT_ROW: ProductSeed = {
  type: 'OTHER',
  childTable: 'other_products',
  child: { description: OTHER_PRODUCT.description },
}

/** A structured CopyShop product; its job auto-advances to pre-press once complete. */
export const POSTER_PRODUCT_ROW: ProductSeed = {
  type: 'POSTER',
  childTable: 'poster_products',
  child: { format: 'A2', material: '120G_AFFICHEN', laminate: 'NEIN', width: 420, height: 594 },
}

/** What the `job` fixture inserts: the department and, optionally, one product. */
export type JobSeed = {
  department: Department
  product: ProductSeed | null
}

/** A job with nothing in it — the default. */
export const EMPTY_JOB: JobSeed = { department: TEST_JOB_DEPARTMENT, product: null }

/** A free-form job with content: complete once the order supplies deadline and delivery, but never auto-advances. */
export const FREE_FORM_JOB_WITH_PRODUCT: JobSeed = { department: 'OTHER', product: OTHER_PRODUCT_ROW }

/** A structured job with content: auto-advances to pre-press once complete. */
export const STRUCTURED_JOB_WITH_PRODUCT: JobSeed = { department: 'COPYSHOP', product: POSTER_PRODUCT_ROW }
