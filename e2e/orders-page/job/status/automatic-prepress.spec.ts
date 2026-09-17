import { expect, test, nextOrderDeadline, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../../../fixtures/orders'
import { PREPRESS_STATUS, STRUCTURED_JOB_WITH_PRODUCT } from '../../../fixtures/jobs'

test.describe('automatic pre-press', () => {
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
})
