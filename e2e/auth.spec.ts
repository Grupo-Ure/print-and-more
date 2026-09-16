import { expect, test } from './fixtures/auth'
import { NAVBAR_VIEWS_BY_ROLE } from './fixtures/navigation'
import { TEST_USERS } from './fixtures/users'
import { NAVBAR_VIEWS, NavbarPOM } from './pom/NavbarPOM'

test.describe('authentication', () => {
  for (const user of Object.values(TEST_USERS)) {
    test.describe(`as ${user.role}`, () => {
      test.use({ user })

      test('signs in with exactly the navigation of the role', async ({ page }) => {
        // Setup — the fixture has signed in as this user.
        const navbar = new NavbarPOM(page)
        const allowed = NAVBAR_VIEWS_BY_ROLE[user.role]

        // Assert — every navbar view is offered or withheld according to the
        // role, and no link outside the known views is rendered.
        for (const view of NAVBAR_VIEWS) {
          const link = navbar.link(view)
          await (allowed.includes(view) ? expect(link).toBeVisible() : expect(link).toBeHidden())
        }
        await expect(navbar.links).toHaveCount(allowed.length)
      })
    })
  }
})
