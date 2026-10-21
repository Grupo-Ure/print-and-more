import { expect, reloadApp, test } from '../fixtures/orders'
import { EDITED_EXPIRY_DAYS } from '../fixtures/customerApprovalSettings'
import { TEST_USERS } from '../fixtures/users'

// Only admins reach the Settings page. The `customerApprovalSettings` fixture
// writes the settings at their defaults and writes them back afterwards.
test.use({ user: TEST_USERS.admin })

test('SET-APR-001 changing the approval expiry shows the new value again after reopening Settings', async ({ settingsPage, page, navbar, customerApprovalSettings }) => {
  // Setup — the Customer approval section open, the field holding the seeded expiry.
  await settingsPage.openSection('approval')
  const { approval } = settingsPage
  const expiry = approval.expiryDays
  await approval.stored(expiry, customerApprovalSettings.expiry_days).waitFor()

  // Act — type the expiry, leave the field, wait for it to be stored, then reload the app and reopen the section.
  await expiry.fill(String(EDITED_EXPIRY_DAYS))
  await expiry.press('Enter')
  await approval.stored(expiry, EDITED_EXPIRY_DAYS).waitFor()
  await reloadApp(page, navbar)
  await settingsPage.openSection('approval')

  // Assert — the field shows the stored expiry, read afresh from the database.
  await expect(expiry).toHaveAttribute('data-value', String(EDITED_EXPIRY_DAYS))
})

test('SET-APR-002 opening Settings lists the customer approval section', async ({ settingsPage }) => {
  // Act — open the Settings page.
  await settingsPage.open()

  // Assert — the section's link is in the list.
  await expect(settingsPage.sectionLink('approval')).toBeVisible()
})
