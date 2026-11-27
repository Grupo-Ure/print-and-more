import { expect, test, NEW_ORDER_STATUS, ORDER_CREATED_HISTORY_EVENT, defaultOrderDeadline } from '../../fixtures/orders'
import { APPROVAL_FILE } from '../../fixtures/files'
import { OTHER_PRODUCT_FORM, PRODUCT_CREATED_HISTORY_EVENT } from '../../fixtures/products'
import { TEST_USERS } from '../../fixtures/users'

// The copy is a second order for the same customer; the `customer` fixture
// removes it with the original, so no test here needs a cleanup stage.

test('ORD-DUP-001 duplicating the order opens the copy as a new quote, selected in the list', async ({ ordersPage, order, product }) => {
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

test('ORD-DUP-002 duplicating the order carries its product and spec into the copy', async ({ ordersPage, order, product }) => {
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

test('ORD-DUP-003 deselecting every product leaves the duplicate unsubmittable', async ({ ordersPage, product }) => {
  // Setup — the original's row; it holds the one product the `product` fixture inserted.
  const row = ordersPage.sidebar.row(product.orderId)

  // Act — open the duplicate dialog and untick its only product.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.product(product.id).click()

  // Assert — a copy of an order that has products but none picked is refused.
  await expect(ordersPage.duplicateDialog.submit).toBeDisabled()
})

test("ORD-DUP-006 opening the duplicate dialog pre-fills the copy's deadline one week out", async ({ ordersPage, product }) => {
  // Setup — the original's row, and the deadline a new order is expected to carry.
  const row = ordersPage.sidebar.row(product.orderId)
  const deadline = defaultOrderDeadline()

  // Act — open the duplicate dialog from the row's menu.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()

  // Assert — the copy starts with the one-week default, as a new order does.
  await expect(ordersPage.duplicateDialog.deadline).toHaveValue(deadline)
})

test("ORD-DUP-007 clearing the copy's deadline leaves the duplicate unsubmittable", async ({ ordersPage, product }) => {
  // Setup — the original's row.
  const row = ordersPage.sidebar.row(product.orderId)

  // Act — open the duplicate dialog and empty its deadline.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.deadline.clear()

  // Assert — a copy without a deadline is refused.
  await expect(ordersPage.duplicateDialog.submit).toBeDisabled()
})

test('ORD-DUP-004 duplicating the order records the copy and its product as one action', async ({ ordersPage, database, order, product }) => {
  // Setup — the original's row, and the employee the suite is signed in as.
  const row = ordersPage.sidebar.row(product.orderId)
  const employeeId = await database.userId(TEST_USERS.employee)

  // Act — duplicate with every product selected, and wait for the copy to open.
  await ordersPage.sidebar.rowMenuTrigger(row).click()
  await ordersPage.sidebar.rowMenuDuplicate.click()
  await ordersPage.duplicateDialog.submit.click()
  await ordersPage.details.forOrderOtherThan(order.id).waitFor()

  // Assert — the copy has one creation entry and one for its product: the employee's, one action, the product's with the copied spec.
  const copyId = await ordersPage.details.shownOrderId()
  const orderEntries = await database.recordedEntries(copyId, ORDER_CREATED_HISTORY_EVENT)
  const productEntries = await database.recordedEntries(copyId, PRODUCT_CREATED_HISTORY_EVENT)
  expect(orderEntries).toEqual([expect.objectContaining({ user_id: employeeId, action_id: expect.any(String) })])
  expect(productEntries).toEqual([
    expect.objectContaining({
      user_id: employeeId,
      action_id: orderEntries[0].action_id,
      meta: expect.objectContaining({
        after: expect.objectContaining({ spec: expect.objectContaining({ description: OTHER_PRODUCT_FORM.description }) }),
      }),
    }),
  ])
})

test.describe('product with a file attached', () => {
  test('ORD-DUP-005 duplicating an order whose product has a file gives the copy a file of its own, attached to its product', async ({
    ordersPage,
    database,
    order,
    product,
    orderFile,
  }) => {
    // Setup — the order's file attached to its product, and the original's row.
    await database.attachFileToProduct(product.id, orderFile.id)
    const row = ordersPage.sidebar.row(order.id)

    // Act — duplicate with every product selected, and wait for the copy to open.
    await ordersPage.sidebar.rowMenuTrigger(row).click()
    await ordersPage.sidebar.rowMenuDuplicate.click()
    await ordersPage.duplicateDialog.submit.click()
    await ordersPage.details.forOrderOtherThan(order.id).waitFor()

    // Assert — the copy's product has one file attached: the copy's own row, naming the same file on the share.
    const copyId = await ordersPage.details.shownOrderId()
    const attachedFiles = await database.attachedFiles(copyId)
    const [copiedFile] = attachedFiles
    expect(attachedFiles).toHaveLength(1)
    expect(copiedFile.orderId).toBe(copyId)
    expect(copiedFile.displayName).toBe(APPROVAL_FILE.display_name)
    expect(copiedFile.path).toBe(APPROVAL_FILE.path)
  })
})
