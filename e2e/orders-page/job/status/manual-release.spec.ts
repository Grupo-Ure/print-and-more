import { expect, test, IN_PROGRESS_ORDER } from '../../../fixtures/orders'
import { FREE_FORM_JOB_WITH_PRODUCT, PREPRESS_STATUS } from '../../../fixtures/jobs'

test.describe('manual release', () => {
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
})
