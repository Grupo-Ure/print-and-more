import { expect, test } from '../../fixtures/orders'
import { TEST_JOB_DEPARTMENT, firstTestJobNumber } from '../../fixtures/jobs'

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
