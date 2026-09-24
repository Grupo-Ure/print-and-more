import { expect, test } from '../fixtures/orders'
import {
  ADMIN_AS_PREPRESS_DEFAULT,
  EMPTY_PREPRESS_DEFAULT,
  EMPTY_PRODUCTION_DEFAULT,
} from '../fixtures/departments'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page; the `departmentDefault` fixture owns
// the slot under test and empties it afterwards.
test.use({ user: TEST_USERS.admin })

test.describe('pre-press slot empty', () => {
  test.use({ departmentDefaultSeed: EMPTY_PREPRESS_DEFAULT })

  test('picking a user as the pre-press default stores it on the row', async ({ settingsPage, database, departmentDefault }) => {
    // Setup — the user to pick, and the Departments section open.
    const userId = await database.userId(TEST_USERS.employee)
    await settingsPage.openSection('departments')
    const { departments } = settingsPage
    const trigger = departments.rowAssignee(departments.row(departmentDefault.department), departmentDefault.status)

    // Act — pick the user in the pre-press combobox.
    await trigger.click()
    await departments.userOption(userId).click()

    // Assert — the row shows the pick.
    await expect(trigger).toHaveAttribute('data-value', userId)
  })
})

test.describe('production slot empty', () => {
  test.use({ departmentDefaultSeed: EMPTY_PRODUCTION_DEFAULT })

  test('picking a user as the production default stores it on the row', async ({ settingsPage, database, departmentDefault }) => {
    // Setup — the user to pick, and the Departments section open.
    const userId = await database.userId(TEST_USERS.employee)
    await settingsPage.openSection('departments')
    const { departments } = settingsPage
    const trigger = departments.rowAssignee(departments.row(departmentDefault.department), departmentDefault.status)

    // Act — pick the user in the production combobox.
    await trigger.click()
    await departments.userOption(userId).click()

    // Assert — the row shows the pick.
    await expect(trigger).toHaveAttribute('data-value', userId)
  })
})

test.describe('pre-press slot held by the admin', () => {
  test.use({ departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  test('choosing unassigned clears the pre-press default from the row', async ({ settingsPage, departmentDefault }) => {
    // Setup — the Departments section open, the seeded default on the row.
    await settingsPage.openSection('departments')
    const { departments } = settingsPage
    const trigger = departments.rowAssignee(departments.row(departmentDefault.department), departmentDefault.status)

    // Act — pick the empty choice.
    await trigger.click()
    await departments.emptyOption.click()

    // Assert — the row holds no default any more.
    await expect(trigger).not.toHaveAttribute('data-value')
  })
})
