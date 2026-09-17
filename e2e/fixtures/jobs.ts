import type { Department, JobStatus } from '../../src/types/database'

/**
 * The department the suite adds jobs to when the department itself is not
 * the point of the test. OTHER has a single product type with two fields and
 * never auto-advances, so a job in it stays in setup while a test builds it.
 */
export const TEST_JOB_DEPARTMENT: Department = 'OTHER'

/** The status every job starts in. */
export const NEW_JOB_STATUS: JobStatus = 'IN_SETUP'

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
