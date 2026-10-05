import { expect, test, IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE, IN_PROGRESS_STATUS, FINISHED_STATUS } from '../../fixtures/orders'
import {
  TEST_PRODUCT_DEPARTMENT,
  OTHER_PRODUCT,
  OTHER_PRODUCT_FORM,
  PRODUCT_IN_PREPRESS,
  PRODUCT_DONE,
  PRODUCT_DELETED_HISTORY_EVENT,
  PRODUCT_CANCELLED_HISTORY_EVENT,
  firstTestProductNumber,
} from '../../fixtures/products'

// Adding a product is a dialog, not an empty row: a stored product always has
// a valid spec, so the department button opens its type's own form and the
// save creates the row. OTHER has one product type, so the picker is skipped.

test('adding a product through its department form selects it in the list', async ({ ordersPage, order }) => {
  // Setup — the number the database assigns to the order's first product of this department, with the order open.
  const productNumber = firstTestProductNumber(order.orderNumber)
  const { productList, productDetail } = ordersPage.details
  await ordersPage.openOrder(order.id)

  // Act — open the department's add dialog and save the product its form describes.
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()
  await productList.addDialog.field('description').fill(OTHER_PRODUCT_FORM.description)
  await productList.addDialog.field('quantity').fill(OTHER_PRODUCT_FORM.quantity)
  await productList.addDialog.submit.click()

  // Assert — the list marks a row active and the detail shows the new product's number.
  await expect(productList.selectedRow).toBeVisible()
  await expect(productDetail.title).toContainText(productNumber)
})

test('cancelling the add-product dialog adds no product to the order', async ({ ordersPage, order }) => {
  // Setup — the add dialog open on the department's only product type.
  const { productList } = ordersPage.details
  await ordersPage.openOrder(order.id)
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()

  // Act — cancel without filling the form in (the click waits for the dialog).
  await productList.addDialog.cancel.click()

  // Assert — the dialog is gone and the order has no product.
  await expect(productList.addDialog.root).toHaveCount(0)
  await expect(productList.empty).toBeVisible()
})

test('deleting a product in setup removes it from the order and records the deletion', async ({ ordersPage, product }) => {
  // Setup — the product open; the default quote seed holds it in setup.
  await ordersPage.openProduct(product)

  // Act — delete it and confirm, then open the history.
  await ordersPage.details.productDetail.deleteButton.click()
  await ordersPage.confirmDialog.confirm.click()
  await ordersPage.details.historyTab.click()

  // Assert — the product is gone from the list and the history says it was deleted.
  await expect(ordersPage.details.productList.row(product.id)).toHaveCount(0)
  await expect(ordersPage.details.history.ofType(PRODUCT_DELETED_HISTORY_EVENT)).toHaveCount(1)
})

test.describe('in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('cancelling a product past setup removes it from the order and records the cancellation', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — cancel it and confirm, then open the history.
    await ordersPage.details.productDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.historyTab.click()

    // Assert — the product is gone from the list and the history says it was cancelled.
    await expect(ordersPage.details.productList.row(product.id)).toHaveCount(0)
    await expect(ordersPage.details.history.ofType(PRODUCT_CANCELLED_HISTORY_EVENT)).toHaveCount(1)
  })

  test('cancelling the only product leaves the order in progress', async ({ ordersPage, order, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — cancel it and confirm.
    await ordersPage.details.productDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — no live product is left, and an order with no work in it is not "finished":
    // it stays in progress and offers no lifecycle action.
    await expect(ordersPage.details.productList.row(product.id)).toHaveCount(0)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
    await expect(ordersPage.details.lifecycle).toHaveCount(0)
  })
})

// ── Removing the last open product of an order whose others are done ──────
// Cancelled products do not count, so either removal can be the moment the
// order's work is complete — the order then finishes on its own, exactly as
// it does when the last product is marked done.

test.describe('in progress, one product done and one in pre-press', () => {
  // An array option goes in as a `[value, options]` tuple — see `productSeeds` in fixtures/orders.ts.
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeeds: [[PRODUCT_DONE, PRODUCT_IN_PREPRESS], { scope: 'test' }] })

  test('cancelling the pre-press product finishes the order on its own', async ({ ordersPage, order, products }) => {
    // Setup — the pre-press product open.
    await ordersPage.openProduct(products[1])

    // Act — cancel it and confirm.
    await ordersPage.details.productDetail.cancelButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — only the done product remains, so the order followed to finished.
    await expect(ordersPage.details.productList.row(products[1].id)).toHaveCount(0)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})

test.describe('in progress without a deadline, one product done and one in setup', () => {
  // No deadline on the order, so the setup product is incomplete and the
  // status manager leaves it there — where it can still be deleted.
  test.use({
    orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE,
    productSeeds: [[PRODUCT_DONE, OTHER_PRODUCT], { scope: 'test' }],
  })

  test('deleting the setup product finishes the order on its own', async ({ ordersPage, order, products }) => {
    // Setup — the setup product open.
    await ordersPage.openProduct(products[1])

    // Act — delete it and confirm.
    await ordersPage.details.productDetail.deleteButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — only the done product remains, so the order followed to finished.
    await expect(ordersPage.details.productList.row(products[1].id)).toHaveCount(0)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', FINISHED_STATUS)
  })
})
