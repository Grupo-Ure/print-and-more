import { expect, test, IN_PROGRESS_ORDER } from '../../fixtures/orders'
import {
  TEST_JOB_DEPARTMENT,
  JOB_IN_PREPRESS,
  JOB_DELETED_HISTORY_EVENT,
  JOB_CANCELLED_HISTORY_EVENT,
  firstTestJobNumber,
} from '../../fixtures/jobs'

test('adding a job to an order selects it and shows its job number in the job detail', async ({ ordersPage, order }) => {
  // Setup — the number the database assigns to the order's first job of this department.
  const jobNumber = firstTestJobNumber(order.orderNumber)

  // Act — open the order and add a job through the department's add-job button.
  await ordersPage.sidebar.row(order.id).click()
  await ordersPage.details.jobList.addJob(TEST_JOB_DEPARTMENT).click()

  // Assert — the list marks a row as active, and the detail shows that job's number.
  await expect(ordersPage.details.jobList.selectedRow).toBeVisible()
  await expect(ordersPage.details.jobDetail.title).toContainText(jobNumber)
})

test('deleting a job in setup removes it from the order and records the deletion', async ({ ordersPage, job }) => {
  // Act — open the order and the job, delete it and confirm, then open the history.
  await ordersPage.sidebar.row(job.orderId).click()
  await ordersPage.details.jobList.row(job.id).click()
  await ordersPage.details.jobDetail.deleteButton.click()
  await ordersPage.confirmDialog.confirm.click()
  await ordersPage.details.historyButton.click()

  // Assert — the job is gone from the list and the history says it was deleted.
  await expect(ordersPage.details.jobList.row(job.id)).toHaveCount(0)
  await expect(ordersPage.details.historyDialog.ofType(JOB_DELETED_HISTORY_EVENT)).toHaveCount(1)
})

test.describe('in progress, job in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS })

  test('cancelling a job past setup removes it from the order and records the cancellation', async ({ ordersPage, order, job }) => {
    // Act — open the order and the job, cancel it and confirm, then open the history.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.historyButton.click()

    // Assert — the job is gone from the list and the history says it was cancelled.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveCount(0)
    await expect(ordersPage.details.historyDialog.ofType(JOB_CANCELLED_HISTORY_EVENT)).toHaveCount(1)
  })
})
