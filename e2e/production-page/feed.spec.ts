import { expect, test } from '../fixtures/production'
import { IN_PROGRESS_ORDER } from '../fixtures/orders'
import { JOB_IN_PREPRESS, JOB_IN_PRODUCTION, EMPTY_JOB } from '../fixtures/jobs'
import { TEST_USERS } from '../fixtures/users'

// Jobs seeded through the runner's connection carry no assignee, so the admin
// tests widen the feed from the signed-in user's own jobs to everyone's first.
test.describe('as admin', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER })

  test.describe('with a job in pre-press', () => {
    test.use({ jobSeed: JOB_IN_PREPRESS })

    test('opening the production page lists the job', async ({ productionPage, job }) => {
      // Act — switch to the production page, widened to everyone's jobs.
      await productionPage.openForEveryone()

      // Assert — the feed has a row for that job.
      await expect(productionPage.sidebar.row(job.id)).toBeVisible()
    })

    test('selecting a job in the feed shows its detail beside the feed', async ({ productionPage, job }) => {
      // Setup — the feed is open, widened to everyone's jobs.
      await productionPage.openForEveryone()

      // Act — select the job's row.
      await productionPage.sidebar.row(job.id).click()

      // Assert — the page still shows the feed, now with that job's detail next to it.
      await expect(productionPage.sidebar.row(job.id)).toBeVisible()
      await expect(productionPage.jobDetail.forJob(job.id)).toBeVisible()
    })

    test('opening a job in the orders view from its panel switches to that view', async ({ productionPage, ordersPage, job }) => {
      // Setup — the job is selected on the production page.
      await productionPage.openJob(job.id)

      // Act — jump to the orders view.
      await productionPage.openInOrders.click()

      // Assert — the orders view has the job's order open with that job selected.
      await expect(ordersPage.details.jobDetail.forJob(job.id)).toBeVisible()
    })
  })

  test.describe('with a job in production', () => {
    test.use({ jobSeed: JOB_IN_PRODUCTION })

    test('opening the production page lists the job', async ({ productionPage, job }) => {
      // Act — switch to the production page, widened to everyone's jobs.
      await productionPage.openForEveryone()

      // Assert — the feed has a row for that job.
      await expect(productionPage.sidebar.row(job.id)).toBeVisible()
    })
  })

  test.describe('with a job still in setup', () => {
    test.use({ jobSeed: EMPTY_JOB })

    test('opening the production page leaves the job out', async ({ productionPage, job }) => {
      // Act — switch to the production page, widened to everyone's jobs.
      await productionPage.openForEveryone()

      // Assert — the feed has rendered and holds no row for that job.
      await expect(productionPage.sidebar.list).toBeVisible()
      await expect(productionPage.sidebar.row(job.id)).toHaveCount(0)
    })
  })
})

test.describe('as employee', () => {
  test.use({ user: TEST_USERS.employee, orderSeed: IN_PROGRESS_ORDER, jobSeed: JOB_IN_PREPRESS })

  test('widening the assignee filter to everyone lists jobs assigned to nobody', async ({ productionPage, job }) => {
    // Setup — the feed is open on its default, the signed-in user's own jobs.
    await productionPage.open()

    // Act — pick "everyone" in the assignee filter.
    await productionPage.sidebar.assigneeFilter.click()
    await productionPage.sidebar.assigneeFilterEveryone.click()

    // Assert — the unassigned job the fixture seeded is now listed.
    await expect(productionPage.sidebar.row(job.id)).toBeVisible()
  })

  test('opening the assignee filter leaves a developer account out of the list', async ({ productionPage, database, developer }) => {
    // Setup — the `developer` fixture flagged the admin; the feed is open.
    const employeeId = await database.userId(TEST_USERS.employee)
    await productionPage.open()

    // Act — open the assignee filter and wait for its list (the employee's own entry).
    await productionPage.sidebar.assigneeFilter.click()
    await productionPage.sidebar.assigneeFilterUser(employeeId).waitFor()

    // Assert — the flagged admin has no entry.
    await expect(productionPage.sidebar.assigneeFilterUser(developer)).toHaveCount(0)
  })
})
