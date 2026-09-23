import {
  expect,
  test,
  COMPLETE_QUOTE_ORDER,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_CASH_ORDER,
  FINISHED_ORDER,
  IN_PROGRESS_STATUS,
  FINISHED_STATUS,
} from '../../fixtures/orders'
import { JOB_DONE, JOB_IN_PRODUCTION, ONE_JOB_PER_DEPARTMENT, DONE_STATUS, PREPRESS_STATUS } from '../../fixtures/jobs'
import { TEST_USERS } from '../../fixtures/users'

test('starting processing a quote moves the order to in progress', async ({ ordersPage, order }) => {
  // Setup — the order open.
  await ordersPage.openOrder(order.id)

  // Act — start processing and confirm.
  await ordersPage.details.lifecycle.click()
  await ordersPage.confirmDialog.confirm.click()

  // Assert — the order is shown in progress.
  await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
})

test.describe('quote with deadline and delivery, one complete job in every department', () => {
  // An array option goes in as a `[value, options]` tuple — see `jobSeeds` in fixtures/orders.ts.
  test.use({ orderSeed: COMPLETE_QUOTE_ORDER, jobSeeds: [ONE_JOB_PER_DEPARTMENT, { scope: 'test' }] })

  test('starting processing promotes every job to pre-press', async ({ ordersPage, order, jobs }) => {
    // Setup — every job expected in pre-press, with the order open and its last job listed.
    const allInPrepress = Object.fromEntries(jobs.map(job => [job.id, PREPRESS_STATUS]))
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(jobs[jobs.length - 1].id).waitFor()

    // Act — start processing and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — all six advanced on their own, not only the selected one.
    await expect.poll(() => ordersPage.details.jobList.rowStatuses()).toEqual(allInPrepress)
  })
})

test.describe('in progress, the only job in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PRODUCTION })

  test('marking the last job done finishes the order on its own', async ({ ordersPage, order, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — mark the job done and confirm; nothing is clicked on the order itself.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is done and the order followed it to finished.
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})

test.describe('in progress, one job done and one in production', () => {
  // An array option goes in as a `[value, options]` tuple — see `jobSeeds` in fixtures/orders.ts.
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeeds: [[JOB_DONE, JOB_IN_PRODUCTION], { scope: 'test' }] })

  test('the order stays in progress with no lifecycle action while a job is still open', async ({ ordersPage, order, jobs }) => {
    // Setup — the order open with both jobs listed; the fixture seeded one of them done.
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(jobs[1].id).waitFor()

    // Assert — one done job is not "every job done": nothing finished the order, nothing offers to.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
    await expect(ordersPage.details.lifecycle).toHaveCount(0)
  })

  test('marking the remaining job done finishes the order on its own', async ({ ordersPage, order, jobs }) => {
    // Setup — the job still in production open.
    await ordersPage.openJob(jobs[1])

    // Act — mark it done and confirm.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — with both jobs done the order followed to finished.
    await expect(ordersPage.details.jobList.row(jobs[1].id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})

test.describe('in progress cash order, the only job in production', () => {
  test.use({ orderSeed: IN_PROGRESS_CASH_ORDER, jobSeed: JOB_IN_PRODUCTION })

  test('marking the last job done leaves the cash order in progress, offering to finish and close it', async ({ ordersPage, order, job }) => {
    // Setup — the job open.
    await ordersPage.openJob(job)

    // Act — mark the job done and confirm.
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the job is done, the order still in progress with the close action offered (never finished by itself).
    await expect(ordersPage.details.jobList.row(job.id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.lifecycle).toHaveAttribute('data-target', 'BILLED')
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})

test.describe('in progress, every job done', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_DONE })

  // The order was seeded with its job already done, so nothing finished it on
  // its own: this is the manual fallback the lifecycle button keeps offering.
  test('marking the order finished moves it to finished', async ({ ordersPage, order, job }) => {
    // Setup — the order open.
    await ordersPage.openOrder(order.id)

    // Act — mark it finished and confirm.
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
    // Setup — finished orders shown in the list (hidden by default), the order open with its done job loaded
    // (the action is offered only once every job is done).
    await ordersPage.sidebar.includeStatus(FINISHED_STATUS)
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(job.id).waitFor()

    // Act — mark it invoiced and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is gone from the list and nothing is selected.
    await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
    await expect(ordersPage.welcome).toBeVisible()
  })
})

test.describe('as admin, finished, every job done', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: FINISHED_ORDER, jobSeed: JOB_DONE })

  test('reopening the order moves it back to in progress', async ({ ordersPage, order, job }) => {
    // Setup — finished orders shown in the list (hidden by default), the order open with its done job loaded.
    await ordersPage.sidebar.includeStatus(FINISHED_STATUS)
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(job.id).waitFor()

    // Act — reopen it and confirm.
    await ordersPage.details.reopen.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is shown in progress again.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })

  test('reopening the order leaves it open, with finishing it again a manual step', async ({ ordersPage, order, job }) => {
    // Setup — finished orders shown in the list (hidden by default), the order open with its done job loaded.
    await ordersPage.sidebar.includeStatus(FINISHED_STATUS)
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(job.id).waitFor()

    // Act — reopen it and confirm.
    await ordersPage.details.reopen.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — every job is still done, yet the order does not finish itself again: the
    // automatic finish only follows a job event, so the manual "Mark finished" is offered.
    await expect(ordersPage.details.lifecycle).toHaveAttribute('data-target', FINISHED_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})

test.describe('in progress cash order, every job done', () => {
  test.use({ orderSeed: IN_PROGRESS_CASH_ORDER, jobSeed: JOB_DONE })

  test('finishing the cash order closes it in one step and removes it from the order list', async ({ ordersPage, order, job }) => {
    // Setup — the order open with its done job loaded (the action is offered only once every job is done).
    await ordersPage.openOrder(order.id)
    await ordersPage.details.jobList.row(job.id).waitFor()

    // Act — finish and close it and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is gone from the list and nothing is selected.
    await expect(ordersPage.sidebar.row(order.id)).toHaveCount(0)
    await expect(ordersPage.welcome).toBeVisible()
  })
})
