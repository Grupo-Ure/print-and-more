import {
  expect,
  test,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_CASH_ORDER,
  FINISHED_ORDER,
  IN_PROGRESS_STATUS,
  FINISHED_STATUS,
} from '../../fixtures/orders'
import { JOB_DONE } from '../../fixtures/jobs'

test('starting processing a quote moves the order to in progress', async ({ ordersPage, order }) => {
  // Act — open the order, start processing and confirm.
  await ordersPage.sidebar.row(order.id).click()
  await ordersPage.details.lifecycle.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is shown in progress.
  await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
})

test.describe('in progress, every job done', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_DONE })

  test('marking the order finished moves it to finished', async ({ ordersPage, order, job }) => {
    // Act — open the order, mark it finished and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is shown finished, its done job still in it.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
    await expect(ordersPage.details.jobList.row(job.id)).toBeVisible()
  })
})

test.describe('finished, every job done', () => {
  test.use({ orderSeed: FINISHED_ORDER, jobSeed: JOB_DONE })

  test('marking the order as invoiced closes it and removes it from the order list', async ({ ordersPage, order, job }) => {
    // Act — show finished orders in the list (hidden by default) and close the filter again
    // (in the compact layout it is a popover over the list), open the order, mark it invoiced and confirm.
    await ordersPage.sidebar.filterToggle.click()
    await ordersPage.sidebar.filters.status(FINISHED_STATUS).click()
    await ordersPage.sidebar.filterToggle.click()
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).waitFor()
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is gone from the list and nothing is selected.
    await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
    await expect(ordersPage.welcome).toBeVisible()
  })
})

test.describe('in progress cash order, every job done', () => {
  test.use({ orderSeed: IN_PROGRESS_CASH_ORDER, jobSeed: JOB_DONE })

  test('finishing the cash order closes it in one step and removes it from the order list', async ({ ordersPage, order, job }) => {
    // Act — open the order, finish and close it and confirm.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).waitFor()
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is gone from the list and nothing is selected.
    await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
    await expect(ordersPage.welcome).toBeVisible()
  })
})
