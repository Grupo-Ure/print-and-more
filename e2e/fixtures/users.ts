import type { UserRole } from '../../src/types/database'

export type TestUser = {
  email: string
  password: string
  /** Display name; the navbar greets by its first word. */
  name: string
  role: UserRole
}

/**
 * The suite's logins. Created by global setup via the Auth admin API and
 * removed by global teardown, so they exist only for the duration of a run.
 */
export const TEST_USERS = {
  employee: {
    email: 'employee@e2e.local',
    password: 'Employee.e2e.11',
    name: 'Employee E2E',
    role: 'EMPLOYEE',
  },
  admin: {
    email: 'admin@e2e.local',
    password: 'Admin.e2e.11',
    name: 'Admin E2E',
    role: 'ADMIN',
  },
} as const satisfies Record<string, TestUser>

/**
 * The admin flagged as a developer account, for the `developer` fixture. The
 * suite signs in as the employee, so the admin is the other login a picker
 * would otherwise list.
 */
export const ADMIN_AS_DEVELOPER: TestUser = TEST_USERS.admin
