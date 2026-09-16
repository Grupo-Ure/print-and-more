import type { Locator, Page } from '@playwright/test'

/** Navbar link labels, keyed by the role that first unlocks them. */
export const NAV_LINKS = {
  /** Everyone. */
  orders: 'Orders',
  /** Admins and up. */
  stampStock: 'Stamp stock',
} as const

export function navLink(page: Page, label: string): Locator {
  return page.getByRole('button', { name: label, exact: true })
}
