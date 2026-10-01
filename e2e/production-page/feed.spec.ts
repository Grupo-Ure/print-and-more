import { expect, test } from '../fixtures/production'
import { IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE } from '../fixtures/orders'
import { PRODUCT_IN_PREPRESS, PRODUCT_IN_PRODUCTION, OTHER_PRODUCT, IN_PRODUCTION_STATUS } from '../fixtures/products'
import { TEST_USERS } from '../fixtures/users'

// Products seeded through the runner's connection carry no assignee, so the
// admin tests widen the feed from the signed-in user's own products to
// everyone's first.
test.describe('as admin', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER })

  test.describe('with a product in pre-press', () => {
    test.use({ productSeed: PRODUCT_IN_PREPRESS })

    test('opening the production page lists the product', async ({ productionPage, product }) => {
      // Act — switch to the production page, widened to everyone's products.
      await productionPage.openForEveryone()

      // Assert — the feed has a row for that product.
      await expect(productionPage.sidebar.row(product.id)).toBeVisible()
    })

    test('selecting a product in the feed shows its detail beside the feed', async ({ productionPage, product }) => {
      // Setup — the feed is open, widened to everyone's products.
      await productionPage.openForEveryone()

      // Act — select the product's row.
      await productionPage.sidebar.row(product.id).click()

      // Assert — the page still shows the feed, now with that product's detail next to it.
      await expect(productionPage.sidebar.row(product.id)).toBeVisible()
      await expect(productionPage.productDetail.forProduct(product.id)).toBeVisible()
    })

    test("the panel above the detail names the product's order", async ({ productionPage, order, product }) => {
      // Setup — the product is selected on the production page.
      await productionPage.openProduct(product.id)

      // Assert — the read-only strip states which order the product belongs to.
      await expect(productionPage.orderNumber).toHaveText(order.orderNumber)
    })

    test('opening a product in the orders view from its panel switches to that view', async ({ productionPage, ordersPage, product }) => {
      // Setup — the product is selected on the production page.
      await productionPage.openProduct(product.id)

      // Act — jump to the orders view.
      await productionPage.openInOrders.click()

      // Assert — the orders view has the product's order open with that product selected.
      await expect(ordersPage.details.productDetail.forProduct(product.id)).toBeVisible()
    })

    test('releasing the product to production from the feed keeps it listed, now in production', async ({ productionPage, product }) => {
      // Setup — the product is selected on the production page.
      await productionPage.openProduct(product.id)

      // Act — release it from the detail beside the feed and confirm.
      await productionPage.productDetail.releaseButton.click()
      await productionPage.confirmDialog.confirm.click()

      // Assert — the feed covers both workflow stages, so the row stays and changes status.
      await expect(productionPage.sidebar.row(product.id)).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
    })
  })

  test.describe('with a product in production', () => {
    test.use({ productSeed: PRODUCT_IN_PRODUCTION })

    test('opening the production page lists the product', async ({ productionPage, product }) => {
      // Act — switch to the production page, widened to everyone's products.
      await productionPage.openForEveryone()

      // Assert — the feed has a row for that product.
      await expect(productionPage.sidebar.row(product.id)).toBeVisible()
    })
  })
})

test.describe('as admin, order without a deadline', () => {
  // No deadline, so the product is incomplete and the status manager leaves
  // it in setup — before the two stages the feed covers.
  test.use({ user: TEST_USERS.admin, orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: OTHER_PRODUCT })

  test('opening the production page leaves a product still in setup out', async ({ productionPage, product }) => {
    // Act — switch to the production page, widened to everyone's products.
    await productionPage.openForEveryone()

    // Assert — the feed has rendered and holds no row for that product.
    await expect(productionPage.sidebar.list).toBeVisible()
    await expect(productionPage.sidebar.row(product.id)).toHaveCount(0)
  })
})

test.describe('as employee', () => {
  test.use({ user: TEST_USERS.employee, orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('widening the assignee filter to everyone lists products assigned to nobody', async ({ productionPage, product }) => {
    // Setup — the feed is open on its default, the signed-in user's own products.
    await productionPage.open()

    // Act — pick "everyone" in the assignee filter.
    await productionPage.sidebar.assigneeFilter.click()
    await productionPage.sidebar.assigneeFilterEveryone.click()

    // Assert — the unassigned product the fixture seeded is now listed.
    await expect(productionPage.sidebar.row(product.id)).toBeVisible()
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
