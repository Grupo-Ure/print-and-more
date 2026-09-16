import { expect, type Locator, type Page } from '@playwright/test'
import { test as base } from './electron'
import { TEST_USERS, type TestUser } from './users'

type AuthFixtures = {
  /**
   * Who the test runs as; `null` for a signed-out app (login-screen tests).
   * Override per file or describe block: `test.use({ user: TEST_USERS.admin })`.
   */
  user: TestUser | null
}

const GREETING = /Hi, /

function firstNameOf(user: TestUser): string {
  return user.name.split(' ')[0] ?? user.name
}

function loginHeading(page: Page): Locator {
  return page.getByRole('heading', { name: 'Welcome back' })
}

/** The navbar's account-menu trigger, which greets the signed-in user. */
function userMenu(page: Page, user?: TestUser): Locator {
  return page.getByRole('button', { name: user ? `Hi, ${firstNameOf(user)}` : GREETING })
}

/** Fills the login form and waits until the app greets the user. */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(userMenu(page, user)).toBeVisible()
}

/** Signs out through the account menu and waits for the login screen. */
export async function signOut(page: Page): Promise<void> {
  await userMenu(page).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(loginHeading(page)).toBeVisible()
}

/**
 * Brings the shared app window into the requested auth state. The app is
 * launched once per worker and keeps its session between tests, so most of
 * the time this finds the right user already signed in and does nothing.
 */
async function ensureAuthState(page: Page, user: TestUser | null): Promise<void> {
  // The app renders nothing until the stored session is resolved, then
  // either the login screen or the navbar with the account menu.
  await expect(loginHeading(page).or(userMenu(page))).toBeVisible()
  const signedOut = await loginHeading(page).isVisible()

  if (user == null) {
    if (!signedOut) await signOut(page)
    return
  }
  if (!signedOut) {
    if (await userMenu(page, user).isVisible()) return
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
