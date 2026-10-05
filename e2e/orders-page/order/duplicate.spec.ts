import { expect, test, NEW_ORDER_STATUS } from '../../fixtures/orders'
import { OTHER_PRODUCT_FORM } from '../../fixtures/products'

// The copy is a second order for the same customer; the `customer` fixture
// removes it with the original, so no test here needs a cleanup stage.

test('duplicating the order opens the copy as a new quote, selected in the list', async ({ ordersPage, order, product }) => {
  // Setup — the original's row; the `product` fixture put one product in it.
  const row = ordersPage.sidebar.row(product.orderId)

  // Act — open the row's menu, duplicate with every product selected (the default).
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.submit.click()

  // Assert — the details show another order, a quote, and the list marks that one selected.
  await expect(ordersPage.details.forOrderOtherThan(order.id)).toHaveAttribute('data-status', NEW_ORDER_STATUS)
  await expect(ordersPage.sidebar.selectedRow).not.toHaveAttribute('data-order-id', order.id)
})

test('duplicating the order carries its product and spec into the copy', async ({ ordersPage, order, product }) => {
  // Setup — the original's row and the copy's product list.
  const row = ordersPage.sidebar.row(product.orderId)
  const { productList, productDetail } = ordersPage.details

  // Act — duplicate with every product selected, wait for the copy to open, then select its only product.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.submit.click()
  await ordersPage.details.forOrderOtherThan(order.id).waitFor()
  await productList.rows.first().click()

  // Assert — one product, carrying the original's spec.
  await expect(productList.rows).toHaveCount(1)
  await expect(productDetail.basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
})

test('deselecting every product leaves the duplicate unsubmittable', async ({ ordersPage, product }) => {
  // Setup — the original's row; it holds the one product the `product` fixture inserted.
  const row = ordersPage.sidebar.row(product.orderId)

  // Act — open the duplicate dialog and untick its only product.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.product(product.id).click()

  // Assert — a copy of an order that has products but none picked is refused.
  await expect(ordersPage.duplicateDialog.submit).toBeDisabled()
})
