import { expect, test } from '../../fixtures/orders'
import { OTHER_PRODUCT } from '../../fixtures/jobs'

test("adding a product to a job lists it in the job's product table", async ({ ordersPage, job }) => {
  // Setup — the job's product section, with the job open.
  const products = ordersPage.details.jobDetail.products
  await ordersPage.openJob(job)

  // Act — open the add-product dialog, fill the form and submit.
  await products.add.click()
  await products.dialog.field('description').fill(OTHER_PRODUCT.description)
  await products.dialog.field('quantity').fill(OTHER_PRODUCT.quantity)
  await products.dialog.submit.click()

  // Assert — the job now lists exactly one product.
  await expect(products.rows).toHaveCount(1)
})
