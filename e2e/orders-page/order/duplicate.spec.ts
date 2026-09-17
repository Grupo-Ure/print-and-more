import { expect, test, NEW_ORDER_STATUS } from '../../fixtures/orders'
import { FREE_FORM_JOB_WITH_PRODUCT } from '../../fixtures/jobs'

// The copy is a second order for the same customer; the `customer` fixture
// removes it with the original, so no test here needs a cleanup stage.

test.describe('quote with a job that has a product', () => {
  test.use({ jobSeed: FREE_FORM_JOB_WITH_PRODUCT })

  test('duplicating the order opens the copy as a new quote, selected in the list', async ({ ordersPage, order, job }) => {
    // Setup — the original's row; the `job` fixture put a job with a product in it.
    const row = ordersPage.sidebar.row(job.orderId)

    // Act — open the row's menu, duplicate with every job selected (the default).
    await ordersPage.sidebar.rowMenuTrigger(row).click()
    await ordersPage.sidebar.rowMenuDuplicate.click()
    await ordersPage.duplicateDialog.submit.click()

    // Assert — the details show another order, a quote, and the list marks that one selected.
    await expect(ordersPage.details.forOrderOtherThan(order.id)).toHaveAttribute('data-status', NEW_ORDER_STATUS)
    await expect(ordersPage.sidebar.selectedRow).not.toHaveAttribute('data-order-id', order.id)
  })

  test('duplicating the order carries its job and product into the copy', async ({ ordersPage, order, job }) => {
    // Setup — the original's row and the copy's product section.
    const row = ordersPage.sidebar.row(job.orderId)
    const products = ordersPage.details.jobDetail.products

    // Act — duplicate with every job selected, wait for the copy to open, then open its only job.
    await ordersPage.sidebar.rowMenuTrigger(row).click()
    await ordersPage.sidebar.rowMenuDuplicate.click()
    await ordersPage.duplicateDialog.submit.click()
    await ordersPage.details.forOrderOtherThan(order.id).waitFor()
    await ordersPage.details.jobList.rows.first().click()

    // Assert — one job, with one product, like the original.
    await expect(ordersPage.details.jobList.rows).toHaveCount(1)
    await expect(products.rows).toHaveCount(1)
  })
})
