import {
  expect,
  test,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_ORDER_WITHOUT_DEADLINE,
  IN_PROGRESS_ORDER_PAST_DEADLINE,
} from '../../fixtures/orders'
import {
  STRUCTURED_JOB_WITH_PRODUCT,
  STRUCTURED_JOB_WITHOUT_PRODUCT,
  JOB_IN_PREPRESS_AWAITING_APPROVAL,
  STAMP_JOB_IN_PREPRESS_OUT_OF_STOCK,
  IN_PRODUCTION_STATUS,
  FORCE_RELEASE_REASON,
  FORCE_RELEASE_HISTORY_EVENT,
} from '../../fixtures/jobs'
import { TEST_USERS } from '../../fixtures/users'

// ── Completeness: what keeps a job in setup ───────────────────────────────

test.describe('in progress, structured job with a product, no deadline', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, jobSeed: STRUCTURED_JOB_WITH_PRODUCT })

  test('opening the job shows it held in setup with the release blocked', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()

    // Assert — the banner names the block and the release cannot be pressed.
    await expect(ordersPage.details.jobDetail.banner).toHaveAttribute('data-kind', 'blocked')
    await expect(ordersPage.details.jobDetail.releaseButton).toBeDisabled()
  })
})

test.describe('in progress, structured job with a product, deadline passed', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_PAST_DEADLINE, jobSeed: STRUCTURED_JOB_WITH_PRODUCT })

  test('opening the job shows it held in setup with the release blocked', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()

    // Assert — the banner names the block and the release cannot be pressed.
    await expect(ordersPage.details.jobDetail.banner).toHaveAttribute('data-kind', 'blocked')
    await expect(ordersPage.details.jobDetail.releaseButton).toBeDisabled()
  })
})

test.describe('in progress, structured job without a product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: STRUCTURED_JOB_WITHOUT_PRODUCT })

  test('opening the job shows it held in setup with the release blocked', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()

    // Assert — the banner names the block and the release cannot be pressed.
    await expect(ordersPage.details.jobDetail.banner).toHaveAttribute('data-kind', 'blocked')
    await expect(ordersPage.details.jobDetail.releaseButton).toBeDisabled()
  })
})

// ── Customer approval ─────────────────────────────────────────────────────

test.describe('in progress, job in pre-press awaiting customer approval', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS_AWAITING_APPROVAL })

  test('opening the job shows the release to production blocked', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()

    // Assert — the release cannot be pressed.
    await expect(ordersPage.details.jobDetail.releaseButton).toBeDisabled()
  })

  test('granting the approval against a file unblocks the release to production', async ({ ordersPage, order, job, orderFile }) => {
    // Setup — the dialogs the approval goes through.
    const settings = ordersPage.details.jobDetail.settingsDialog

    // Act — open the order and the job, grant the approval against the linked file, close the settings.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.settingsButton.click()
    await settings.grantApproval.click()
    await settings.grantDialog.file(orderFile.id).click()
    await settings.grantDialog.submit.click()
    await settings.approvalGranted.waitFor()
    await settings.close.click()

    // Assert — the release can be pressed.
    await expect(ordersPage.details.jobDetail.releaseButton).toBeEnabled()
  })
})

// ── Stock ─────────────────────────────────────────────────────────────────

test.describe('in progress, stamp job in pre-press, model out of stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: STAMP_JOB_IN_PREPRESS_OUT_OF_STOCK })

  test('opening the job shows the shortage and blocks the release to production', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()

    // Assert — the banner names the shortage, the product is flagged, and the release cannot be pressed.
    await expect(ordersPage.details.jobDetail.banner).toHaveAttribute('data-kind', 'shortage')
    await expect(ordersPage.details.jobDetail.products.shortageRows).toHaveCount(1)
    await expect(ordersPage.details.jobDetail.releaseButton).toBeDisabled()
  })
})

// ── Force release (admin) ─────────────────────────────────────────────────

test.describe('as admin, in progress, structured job with a product, no deadline', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, jobSeed: STRUCTURED_JOB_WITH_PRODUCT })

  test('opening the force release prompt without a reason keeps it unsubmittable', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, then the force release from the release menu.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseMenuTrigger.click()
    await ordersPage.details.jobDetail.forceReleaseItem.click()

    // Assert — nothing can be submitted until a reason is given.
    await expect(ordersPage.details.jobDetail.forceReleaseDialog.submit).toBeDisabled()
  })

  test('force releasing the job with a reason moves it to production flagged as missing information', async ({ ordersPage, order, job }) => {
    // Setup — the job's row in the list.
    const row = ordersPage.details.jobList.row(job.id)

    // Act — open the order and the job, force release it with a reason.
    await ordersPage.sidebar.row(order.id).click()
    await row.click()
    await ordersPage.details.jobDetail.releaseMenuTrigger.click()
    await ordersPage.details.jobDetail.forceReleaseItem.click()
    await ordersPage.details.jobDetail.forceReleaseDialog.reason.fill(FORCE_RELEASE_REASON)
    await ordersPage.details.jobDetail.forceReleaseDialog.submit.click()

    // Assert — the job is in production and carries the missing-information warning.
    await expect(row).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
    await expect(ordersPage.details.jobList.rowMissingInfo(row)).toBeVisible()
  })

  test('force releasing the job records an emergency entry in the order history', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, force release it with a reason, then open the history.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseMenuTrigger.click()
    await ordersPage.details.jobDetail.forceReleaseItem.click()
    await ordersPage.details.jobDetail.forceReleaseDialog.reason.fill(FORCE_RELEASE_REASON)
    await ordersPage.details.jobDetail.forceReleaseDialog.submit.click()
    await ordersPage.details.historyButton.click()

    // Assert — the history holds the emergency entry.
    await expect(ordersPage.details.historyDialog.ofType(FORCE_RELEASE_HISTORY_EVENT)).toHaveCount(1)
  })
})
