import { expect, test } from '../fixtures/auth'
import { NAVBAR_VIEWS_BY_ROLE } from '../fixtures/navigation'
import { TEST_USERS } from '../fixtures/users'

test.describe('authentication', () => {
  test.describe('signed out', () => {
    test.use({ user: null })

    // The login itself is the behaviour under test here, so this test spells
    // out the steps instead of using the sign-in helper every other test
    // relies on through the `page` fixture.
    test('signing in with email and password shows the user in the navbar', async ({ login, navbar }) => {
      // Setup — the account to sign in with.
      const user = TEST_USERS.employee

      // Act — fill the form and submit.
      await login.email.fill(user.email)
      await login.password.fill(user.password)
      await login.submit.click()

      // Assert — the navbar shows that user signed in.
      await expect(navbar.userMenu.signedInAs(user.email)).toBeVisible()
    })
  })

  for (const user of Object.values(TEST_USERS)) {
    test.describe(`as ${user.role}`, () => {
      test.use({ user })

      test('signing in renders exactly the navigation links of the role', async ({ navbar }) => {
        // Setup — the views this role is allowed to see; the fixture has already signed in as this user.
        const allowed = new Set(NAVBAR_VIEWS_BY_ROLE[user.role])

        // Assert — the rendered links are exactly the role's views, no more, no less.
        await expect.poll(async () => new Set(await navbar.renderedViews())).toEqual(allowed)
      })
    })
  }
})
