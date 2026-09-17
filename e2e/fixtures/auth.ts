/**
 * Fixture chain: `@playwright/test` → database → electron → **auth** → orders.
 * Adds `user` (who the test runs as), brings `page` into that auth state, and
 * hands out the page objects of the session-level UI (`login`, `navbar`).
 */
import type { Page } from '@playwright/test'
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
  /** The sign-in screen (rendered only without a session). */
  login: LoginPOM
  /** The top navigation bar (rendered only with a session). */
  navbar: NavbarPOM
}

// No `expect` in here: fixtures synchronise with `waitFor()`. A timeout then
// reads as a setup failure, not as a test assertion.

/** Fills the login form and waits until the navbar shows this user signed in. */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  const login = new LoginPOM(page)
  const { userMenu } = new NavbarPOM(page)
  await login.signIn(user)
  await userMenu.signedInAs(user.email).waitFor()
}

/** Signs out through the account menu and waits for the login screen. */
export async function signOut(page: Page): Promise<void> {
  const login = new LoginPOM(page)
  const { userMenu } = new NavbarPOM(page)
  await userMenu.open()
  await userMenu.signOut.click()
  await login.root.waitFor()
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
  await login.root.or(userMenu.trigger).waitFor()
  const signedOut = await login.root.isVisible()

  if (user == null) {
    if (!signedOut) await signOut(page)
    return
  }
  if (!signedOut) {
    if (await userMenu.signedInAs(user.email).isVisible()) return
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

  login: async ({ page }, use) => {
    await use(new LoginPOM(page))
  },

  navbar: async ({ page }, use) => {
    await use(new NavbarPOM(page))
  },
})

export { expect } from '@playwright/test'
