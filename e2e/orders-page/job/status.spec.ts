import { expect, test, nextOrderDeadline, IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../../fixtures/orders'
import {
  LFP_JOB_WITH_PRODUCT,
  COPYSHOP_JOB_WITH_PRODUCT,
  TEXTILE_JOB_WITH_PRODUCT,
  STAMP_JOB_WITH_PRODUCT,
  LASER_JOB_WITH_PRODUCT,
  OTHER_JOB_WITH_PRODUCT,
  JOB_IN_PREPRESS,
  JOB_IN_PRODUCTION,
  PREPRESS_STATUS,
  IN_PRODUCTION_STATUS,
  DONE_STATUS,
} from '../../fixtures/jobs'
import {
  ADMIN_AS_PREPRESS_DEFAULT,
  ADMIN_AS_PRODUCTION_DEFAULT,
  ASSIGNEE_CHANGED_HISTORY_EVENT,
} from '../../fixtures/departments'

test.describe('in progress, job with a product, deadline missing', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, jobSeed: COPYSHOP_JOB_WITH_PRODUCT })

  test('setting the deadline completes the job and promotes it to pre-press', async ({ ordersPage, order, job }) => {
    // Setup — a date the picker accepts, with the order open.
    const deadline = nextOrderDeadline()
    const picker = ordersPage.details.deadline
    await ordersPage.openOrder(order.id)

    // Act — pick the deadline, the job's last missing requirement.
    await picker.trigger.click()
    await picker.showMonthOf(deadline)
    await picker.day(deadline).click()

    // Assert — the job advanced on its own.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

// ── Auto-promotion, one department at a time ──────────────────────────────
// Each fixture seeds the job complete and in setup; opening it must find it
// already promoted. One block per department, so a department that stops
// advancing is named in the report.

test.describe('in progress, complete LFP job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: LFP_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete CopyShop job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: COPYSHOP_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete textile job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: TEXTILE_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete stamp job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: STAMP_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete laser-engraving job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: LASER_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete OTHER job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: OTHER_JOB_WITH_PRODUCT })

  test('the job is promoted to pre-press on its own', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

// ── The manual steps after pre-press ──────────────────────────────────────

test.describe('in progress, job in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS })

  test('releasing the job to production moves it to in production', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — release it and confirm.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is in production.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })
})

test.describe('in progress, job in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PRODUCTION })

  test('marking the job as done moves it to done', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — mark it done and confirm.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is done.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', DONE_STATUS)
  })
})

// ── Stage defaults ────────────────────────────────────────────────────────
// The fixture puts the admin into one stage's slot of the job's department.
// Seeded jobs carry no assignee and the suite runs as the employee, so the
// admin can only hold the job through the default.

test.describe('in progress, complete OTHER job, pre-press default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: OTHER_JOB_WITH_PRODUCT, departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  test('the job promoted to pre-press is assigned to the pre-press default', async ({ ordersPage, job, departmentDefault }) => {
    // Setup — the job open; it is promoted on the way.
    await ordersPage.openJob(job)

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.jobDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})

test.describe('in progress, job in pre-press, production default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS, departmentDefaultSeed: ADMIN_AS_PRODUCTION_DEFAULT })

  test('releasing the job to production assigns it to the production default', async ({ ordersPage, job, departmentDefault }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — release it and confirm.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the production default holds it.
    await expect(ordersPage.details.jobDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })

  // `departmentDefault` is requested for its side effect: without it the slot stays empty and nothing is logged.
  test('releasing the job to production records the assignee change in the order history', async ({ ordersPage, job, departmentDefault: _productionDefault }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — release it and confirm, then open the history.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.historyButton.click()

    // Assert — the history holds the assignee change.
    await expect(ordersPage.details.historyDialog.ofType(ASSIGNEE_CHANGED_HISTORY_EVENT)).toHaveCount(1)
  })
})

test.describe('in progress, job in production, pre-press default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PRODUCTION, departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  test('sending the job back to pre-press assigns it to the pre-press default', async ({ ordersPage, job, departmentDefault }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — go back to pre-press from the banner.
    await ordersPage.details.jobDetail.backToPrepress.click()

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.jobDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})
