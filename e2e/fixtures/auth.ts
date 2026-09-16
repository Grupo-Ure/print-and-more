import { expect, type Page } from '@playwright/test'
import { test as base } from './electron'
import { TEST_USERS, type TestUser } from './users'
import { LoginPOM } from '../pom/LoginPOM'
import { NavbarPOM } from '../pom/NavbarPOM'

type AuthFixtures = {
  /**
   * Who the test runs as; `null` for a signed-out app (login-screen tests).
   * Override per file or describe block: `test.use({ user: TEST_USERS.admin })`.
   */
  user: TestUser | null
}

/** Fills the login form and waits until the navbar greets the user. */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  const login = new LoginPOM(page)
  const { userMenu } = new NavbarPOM(page)
  await login.signIn(user)
  await expect(userMenu.trigger).toHaveAttribute('data-user-email', user.email)
}

/** Signs out through the account menu and waits for the login screen. */
export async function signOut(page: Page): Promise<void> {
  const login = new LoginPOM(page)
  const { userMenu } = new NavbarPOM(page)
  await userMenu.open()
  await userMenu.signOut.click()
  await expect(login.root).toBeVisible()
}

/**
 * Brings the shared app window into the requested auth state. The app is
 * launched once per worker and keeps its session between tests, so most of
 * the time this finds the right user already signed in and does nothing.
 */
async function ensureAuthState(page: Page, user: TestUser | null): Promise<void> {
  const login = new LoginPOM(page)
  const { userMenu } = new NavbarPOM(page)

  // The app renders nothing until the stored session is resolved, then
  // either the login screen or the navbar with the account menu.
  await expect(login.root.or(userMenu.trigger)).toBeVisible()
  const signedOut = await login.root.isVisible()

  if (user == null) {
    if (!signedOut) await signOut(page)
    return
  }
  if (!signedOut) {
    if ((await userMenu.signedInEmail()) === user.email) return
    await signOut(page)
  }
  await signIn(page, user)
}

export const test = base.extend<AuthFixtures>({
  user: [TEST_USERS.employee, { option: true }],

  page: async ({ page, user }, use) => {
    await ensureAuthState(page, user)
    await use(page)
  },
})

export { expect } from '@playwright/test'
