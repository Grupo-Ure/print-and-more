import { expect, test } from '../fixtures/auth'
import { NAVBAR_VIEWS_BY_ROLE } from '../fixtures/navigation'
import { TEST_USERS } from '../fixtures/users'

test.describe('authentication', () => {
  for (const user of Object.values(TEST_USERS)) {
    test.describe(`as ${user.role}`, () => {
      test.use({ user })

      test('signs in with exactly the navigation of the role', async ({ navbar }) => {
        // Setup — the views this role is allowed to see; the fixture has already signed in as this user.
        const allowed = new Set(NAVBAR_VIEWS_BY_ROLE[user.role])

        // Assert — the rendered links are exactly the role's views, no more, no less.
        await expect.poll(async () => new Set(await navbar.renderedViews())).toEqual(allowed)
      })
    })
  }
})
