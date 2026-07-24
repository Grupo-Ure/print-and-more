import type { UserRole } from '../types/database'

/** UI display labels for the `user_role` enum. */
export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: 'Employee',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
}
