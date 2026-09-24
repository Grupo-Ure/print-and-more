import type { DefaultAssigneeStatus, Department } from '../../src/types/database'
import type { Database } from '../../src/types/supabase'
import { TEST_JOB_DEPARTMENT } from './jobs'
import { TEST_USERS, type TestUser } from './users'

type HistoryEvent = Database['public']['Enums']['history_event']

/**
 * What the `departmentDefault` fixture owns: one department's slot for one
 * stage, and who to put in it — `null` leaves the slot empty for a test that
 * fills it through the app. The slot is cleared after the test either way.
 */
export type DepartmentDefaultSeed = {
  department: Department
  status: DefaultAssigneeStatus
  user: TestUser | null
}

/** The history entry an assignee change writes — by hand, or by the stage default when a job enters the stage. */
export const ASSIGNEE_CHANGED_HISTORY_EVENT: HistoryEvent = 'ASSIGNEE_CHANGED'

/** The pre-press slot of the suite's job department, left empty. */
export const EMPTY_PREPRESS_DEFAULT: DepartmentDefaultSeed = {
  department: TEST_JOB_DEPARTMENT,
  status: 'PREPRESS',
  user: null,
}

/** The production slot of the suite's job department, left empty. */
export const EMPTY_PRODUCTION_DEFAULT: DepartmentDefaultSeed = { ...EMPTY_PREPRESS_DEFAULT, status: 'IN_PRODUCTION' }

/**
 * The admin as the pre-press default. The suite signs in as the employee, so
 * a job the admin holds can only have got there through the default.
 */
export const ADMIN_AS_PREPRESS_DEFAULT: DepartmentDefaultSeed = { ...EMPTY_PREPRESS_DEFAULT, user: TEST_USERS.admin }

/** The admin as the production default, for the same reason. */
export const ADMIN_AS_PRODUCTION_DEFAULT: DepartmentDefaultSeed = { ...EMPTY_PRODUCTION_DEFAULT, user: TEST_USERS.admin }
