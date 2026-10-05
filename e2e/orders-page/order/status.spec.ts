import {
  expect,
  test,
  COMPLETE_QUOTE_ORDER,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_CASH_ORDER,
  FINISHED_ORDER,
  IN_PROGRESS_STATUS,
  FINISHED_STATUS,
  BILLED_STATUS,
} from '../../fixtures/orders'
import { PRODUCT_DONE, PRODUCT_IN_PRODUCTION, ONE_PRODUCT_PER_DEPARTMENT, DONE_STATUS, PREPRESS_STATUS } from '../../fixtures/products'
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

test.describe('quote with deadline and delivery, one product in every department', () => {
  // An array option goes in as a `[value, options]` tuple — see `productSeeds` in fixtures/orders.ts.
  test.use({ orderSeed: COMPLETE_QUOTE_ORDER, productSeeds: [ONE_PRODUCT_PER_DEPARTMENT, { scope: 'test' }] })

  test('starting processing promotes every product to pre-press', async ({ ordersPage, order, products }) => {
    // Setup — every product expected in pre-press, with the order open and its last product listed.
    const allInPrepress = Object.fromEntries(products.map(product => [product.id, PREPRESS_STATUS]))
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(products[products.length - 1].id).waitFor()

    // Act — start processing and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — all six advanced on their own; they share one status watcher per order.
    await expect.poll(() => ordersPage.details.productList.rowStatuses()).toEqual(allInPrepress)
  })
})

test.describe('in progress, the only product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('marking the last product done finishes the order on its own', async ({ ordersPage, order, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — mark the product done and confirm; nothing is clicked on the order itself.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is done and the order followed it to finished.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})

test.describe('in progress, one product done and one in production', () => {
  // An array option goes in as a `[value, options]` tuple — see `productSeeds` in fixtures/orders.ts.
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeeds: [[PRODUCT_DONE, PRODUCT_IN_PRODUCTION], { scope: 'test' }] })

  test('the order stays in progress with no lifecycle action while a product is still open', async ({ ordersPage, order, products }) => {
    // Setup — the order open with both products listed; the fixture seeded one of them done.
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(products[1].id).waitFor()

    // Assert — one done product is not "every product done": nothing finished the order, nothing offers to.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
    await expect(ordersPage.details.lifecycle).toHaveCount(0)
  })

  test('marking the remaining product done finishes the order on its own', async ({ ordersPage, order, products }) => {
    // Setup — the product still in production open.
    await ordersPage.openProduct(products[1])

    // Act — mark it done and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — with both products done the order followed to finished.
    await expect(ordersPage.details.productList.row(products[1].id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})

test.describe('in progress cash order, the only product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_CASH_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('marking the last product done leaves the cash order in progress, offering to finish and close it', async ({ ordersPage, order, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — mark the product done and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is done, the order still in progress with the close action offered (never finished by itself).
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', DONE_STATUS)
    await expect(ordersPage.details.lifecycle).toHaveAttribute('data-target', 'BILLED')
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})

test.describe('in progress, every product done', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_DONE })

  // The order was seeded with its product already done, so nothing finished it
  // on its own: this is the manual fallback the lifecycle button keeps offering.
  test('marking the order finished moves it to finished', async ({ ordersPage, order, product }) => {
    // Setup — the order open.
    await ordersPage.openOrder(order.id)

    // Act — mark it finished and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is shown finished, its done product still in it.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
    await expect(ordersPage.details.productList.row(product.id)).toBeVisible()
  })
})

test.describe('finished, every product done', () => {
  test.use({ orderSeed: FINISHED_ORDER, productSeed: PRODUCT_DONE })

  test('marking the order as invoiced closes it and keeps it in the order list', async ({ ordersPage, order, product }) => {
    // Setup — the order open with its done product loaded (the action is offered only once every product is done).
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(product.id).waitFor()

    // Act — mark it invoiced and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order stays open and listed, now billed.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', BILLED_STATUS)
    await expect(ordersPage.sidebar.row(order.id)).toHaveAttribute('data-status', BILLED_STATUS)
  })
})

test.describe('as admin, finished, every product done', () => {
  test.use({ user: TEST_USERS.admin, orderSeed: FINISHED_ORDER, productSeed: PRODUCT_DONE })

  test('reopening the order moves it back to in progress', async ({ ordersPage, order, product }) => {
    // Setup — the order open with its done product loaded.
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(product.id).waitFor()

    // Act — reopen it and confirm.
    await ordersPage.details.reopen.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order is shown in progress again.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })

  test('reopening the order leaves it open, with finishing it again a manual step', async ({ ordersPage, order, product }) => {
    // Setup — the order open with its done product loaded.
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(product.id).waitFor()

    // Act — reopen it and confirm.
    await ordersPage.details.reopen.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — every product is still done, yet the order does not finish itself again: the
    // automatic finish only follows a product event, so the manual "Mark finished" is offered.
    await expect(ordersPage.details.lifecycle).toHaveAttribute('data-target', FINISHED_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})

test.describe('in progress cash order, every product done', () => {
  test.use({ orderSeed: IN_PROGRESS_CASH_ORDER, productSeed: PRODUCT_DONE })

  test('finishing the cash order closes it in one step and keeps it in the order list', async ({ ordersPage, order, product }) => {
    // Setup — the order open with its done product loaded (the action is offered only once every product is done).
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(product.id).waitFor()

    // Act — finish and close it and confirm.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the order stays open and listed, now billed.
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', BILLED_STATUS)
    await expect(ordersPage.sidebar.row(order.id)).toHaveAttribute('data-status', BILLED_STATUS)
  })
})
