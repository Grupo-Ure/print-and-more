import type { UserRole } from '../../src/types/database'
import type { NavbarView } from '../pom/NavbarPOM'

/**
 * The navbar links each role is entitled to — exactly these, no more and no
 * less. Roles are hierarchical: admins get the stock pages and settings; the
 * super-admin-only part (user management) is a section inside settings, not
 * a link of its own.
 */
export const NAVBAR_VIEWS_BY_ROLE: Record<UserRole, readonly NavbarView[]> = {
  EMPLOYEE: ['orders', 'production'],
  ADMIN: ['orders', 'production', 'stampStock', 'textileStock', 'settings'],
  SUPER_ADMIN: ['orders', 'production', 'stampStock', 'textileStock', 'settings'],
}
