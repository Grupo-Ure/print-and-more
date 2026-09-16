import type { UserRole } from '../../src/types/database'
import type { NavbarView } from '../pom/NavbarPOM'

/**
 * The navbar links each role is entitled to — exactly these, no more and no
 * less. Roles are hierarchical: admins get the stock pages, super admins
 * additionally user management.
 */
export const NAVBAR_VIEWS_BY_ROLE: Record<UserRole, readonly NavbarView[]> = {
  EMPLOYEE: ['orders'],
  ADMIN: ['orders', 'stampStock', 'textileStock'],
  SUPER_ADMIN: ['orders', 'stampStock', 'textileStock', 'userManagement'],
}
