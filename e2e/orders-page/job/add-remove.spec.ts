import { expect, test, IN_PROGRESS_ORDER } from '../../fixtures/orders'
import {
  TEST_JOB_DEPARTMENT,
  JOB_IN_PREPRESS,
  JOB_DELETED_HISTORY_EVENT,
  JOB_CANCELLED_HISTORY_EVENT,
  firstTestJobNumber,
} from '../../fixtures/jobs'

test('adding a job to an order selects it and opens its add-product dialog', async ({ ordersPage, order }) => {
  // Setup — the number the database assigns to the order's first job of this department, with the order open.
  const jobNumber = firstTestJobNumber(order.orderNumber)
  await ordersPage.openOrder(order.id)

  // Act — add a job through the department's add-job button.
  await ordersPage.details.jobList.addJob(TEST_JOB_DEPARTMENT).click()

  // Assert — the list marks a row as active, the detail shows that job's number,
  // and the product dialog is already open in "add" mode so the first product
  // can be entered without another click.
  await expect(ordersPage.details.jobList.selectedRow).toBeVisible()
  await expect(ordersPage.details.jobDetail.title).toContainText(jobNumber)
  await expect(ordersPage.details.jobDetail.products.dialog.root).toHaveAttribute('data-mode', 'add')
})

test('cancelling the add-product dialog of a new job keeps the empty job selected', async ({ ordersPage, order }) => {
  // Setup — a job just added through the UI, which opens its add-product dialog.
  const jobNumber = firstTestJobNumber(order.orderNumber)
  const products = ordersPage.details.jobDetail.products
  await ordersPage.openOrder(order.id)
  await ordersPage.details.jobList.addJob(TEST_JOB_DEPARTMENT).click()

  // Act — cancel without entering a product (the click waits for the dialog).
  await products.dialog.cancel.click()

  // Assert — the dialog is gone and the job remains selected.
  await expect(products.dialog.root).toHaveCount(0)
  await expect(ordersPage.details.jobDetail.title).toContainText(jobNumber)
})

test('deleting a job in setup removes it from the order and records the deletion', async ({ ordersPage, job }) => {
  // Setup — the job open.
  await ordersPage.openJob(job)

  // Act — delete it and confirm, then open the history.
  await ordersPage.details.jobDetail.deleteButton.click()
  await ordersPage.confirmDialog.confirm.click()
  await ordersPage.details.historyButton.click()

  // Assert — the job is gone from the list and the history says it was deleted.
  await expect(ordersPage.details.jobList.row(job.id)).toHaveCount(0)
  await expect(ordersPage.details.historyDialog.ofType(JOB_DELETED_HISTORY_EVENT)).toHaveCount(1)
})

test.describe('in progress, job in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS })

  test('cancelling a job past setup removes it from the order and records the cancellation', async ({ ordersPage, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — cancel it and confirm, then open the history.
    await ordersPage.details.jobDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.historyButton.click()

    // Assert — the job is gone from the list and the history says it was cancelled.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveCount(0)
    await expect(ordersPage.details.historyDialog.ofType(JOB_CANCELLED_HISTORY_EVENT)).toHaveCount(1)
  })
})
