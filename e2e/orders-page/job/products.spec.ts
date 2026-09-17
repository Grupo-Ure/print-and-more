import { expect, test } from '../../fixtures/orders'
import { OTHER_PRODUCT } from '../../fixtures/jobs'

test.describe('job products', () => {
  test("adding a product to a job lists it in the job's product table", async ({ ordersPage, job }) => {
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
})
