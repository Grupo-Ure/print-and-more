import { expect, test, nextOrderDeadline, IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../../fixtures/orders'
import {
  FREE_FORM_JOB_WITH_PRODUCT,
  STRUCTURED_JOB_WITH_PRODUCT,
  JOB_IN_PREPRESS,
  JOB_IN_PRODUCTION,
  PREPRESS_STATUS,
  IN_PRODUCTION_STATUS,
  DONE_STATUS,
} from '../../fixtures/jobs'

test.describe('in progress, structured job with a product, deadline missing', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, jobSeed: STRUCTURED_JOB_WITH_PRODUCT })

  test('setting the deadline completes the job and promotes it to pre-press', async ({ ordersPage, order, job }) => {
    // Setup — a date the picker accepts.
    const deadline = nextOrderDeadline()

    // Act — open the order and pick the deadline, the job's last missing requirement.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.deadline.pick(deadline)

    // Assert — the job advanced on its own.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, complete free-form job', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: FREE_FORM_JOB_WITH_PRODUCT })

  test('releasing the job manually moves it to pre-press', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, release it and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is in pre-press.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, job in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS })

  test('releasing the job to production moves it to in production', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, release it and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is in production.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })
})

test.describe('in progress, job in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PRODUCTION })

  test('marking the job as done moves it to done', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, mark it done and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is done.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', DONE_STATUS)
  })
})
