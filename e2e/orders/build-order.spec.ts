import { expect, test, nextOrderDeadline } from '../fixtures/orders'
import { OTHER_PRODUCT, TEST_JOB_DEPARTMENT, firstTestJobNumber } from '../fixtures/jobs'

test.describe('build the order', () => {
  test('adds a job, which gets a job number and becomes the active job', async ({ ordersPage, order }) => {
    // Setup — the number the database assigns to the order's first job of this department.
    const jobNumber = firstTestJobNumber(order.orderNumber)

    // Act — open the order and add a job through the department's add-job button.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.addJob(TEST_JOB_DEPARTMENT).click()

    // Assert — the list marks a row as active, and the detail shows that job's number.
    await expect(ordersPage.details.jobList.selectedRow).toBeVisible()
    await expect(ordersPage.details.jobDetail.title).toContainText(jobNumber)
  })

  test('adds a product to the active job', async ({ ordersPage, job }) => {
    // Setup — the job's product section.
    const products = ordersPage.details.jobDetail.products

    // Act — open the order and the job, then add a product through the dialog.
    await ordersPage.sidebar.row(job.orderId).click()
    await ordersPage.details.jobList.row(job.id).click()
    await products.add.click()
    await products.dialog.fill(OTHER_PRODUCT)
    await products.dialog.submit.click()

    // Assert — that job now lists exactly one product.
    await expect(ordersPage.details.jobDetail.forJob(job.id)).toBeVisible()
    await expect(products.rows).toHaveCount(1)
  })

  test('sets the order deadline', async ({ ordersPage, order }) => {
    // Setup — a date the picker accepts.
    const deadline = nextOrderDeadline()
    const picker = ordersPage.details.deadline

    // Act — open the order and pick the date in the deadline calendar.
    await ordersPage.sidebar.row(order.id).click()
    await picker.pick(deadline)

    // Assert — the settings row shows that deadline for the order.
    await expect(ordersPage.details.forOrder(order.id)).toBeVisible()
    await expect(picker.trigger).toHaveAttribute('data-value', deadline)
  })
})
