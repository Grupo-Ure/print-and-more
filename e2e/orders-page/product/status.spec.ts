import {
  expect,
  test,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_ORDER_PAST_DEADLINE,
  FINISHED_STATUS,
} from '../../fixtures/orders'
import {
  BANNER_PRODUCT,
  POSTER_PRODUCT,
  SHOP_SUPPLIED_TEXTILE_BATCH,
  IN_STOCK_STAMP_PRODUCT,
  SIGN_PRODUCT,
  OTHER_PRODUCT,
  PRODUCT_IN_PREPRESS,
  PRODUCT_IN_PRODUCTION,
  PREPRESS_STATUS,
  IN_PRODUCTION_STATUS,
  DONE_STATUS,
  MARKED_DONE_HISTORY_EVENT,
  PREPRESS_READY_HISTORY_EVENT,
  RETURNED_TO_PREPRESS_HISTORY_EVENT,
} from '../../fixtures/products'
import {
  ADMIN_AS_PREPRESS_DEFAULT,
  ADMIN_AS_PRODUCTION_DEFAULT,
  ASSIGNEE_CHANGED_HISTORY_EVENT,
} from '../../fixtures/departments'
import { TEST_USERS } from '../../fixtures/users'

test.describe('quote, poster product', () => {
  test.use({ productSeed: POSTER_PRODUCT })

  test("PRD-STA-015 starting processing records the product's move to pre-press in the order history", async ({
    ordersPage,
    order,
    product,
  }) => {
    // Setup — the order open, its product listed.
    await ordersPage.openOrder(order.id)
    await ordersPage.details.productList.row(product.id).waitFor()

    // Act — start processing and confirm, then open the order's history once the product has moved.
    await ordersPage.details.lifecycle.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productList.rowInStatus(product.id, PREPRESS_STATUS).waitFor()
    await ordersPage.details.historyTab.click()

    // Assert — the move nobody clicked is on record, once.
    await expect(ordersPage.details.history.ofType(PREPRESS_READY_HISTORY_EVENT)).toHaveCount(1)
  })
})

// ── Auto-promotion, one department at a time ──────────────────────────────
// Each fixture seeds the product in setup in an order that supplies the
// deadline it inherits; opening it must find it already promoted. One block
// per department, so a department that stops advancing is named in the report.

test.describe('in progress, LFP product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: BANNER_PRODUCT })

  test('PRD-STA-002 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, CopyShop product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: POSTER_PRODUCT })

  test('PRD-STA-003 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, textile batch', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: SHOP_SUPPLIED_TEXTILE_BATCH })

  test('PRD-STA-004 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, stamp product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: IN_STOCK_STAMP_PRODUCT })

  test('PRD-STA-005 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, laser-engraving product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: SIGN_PRODUCT })

  test('PRD-STA-006 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, OTHER product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: OTHER_PRODUCT })

  test('PRD-STA-007 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, product whose deadline has passed', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_PAST_DEADLINE, productSeed: POSTER_PRODUCT })

  test('PRD-STA-008 the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — a past deadline does not hold it back.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

// ── The manual steps after pre-press ──────────────────────────────────────

test.describe('in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-STA-009 releasing the product to production moves it to in production', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — release it and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is in production.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })

  test('PRD-STA-019 reassigning the product by hand records the previous and the new assignee in the order history', async ({
    ordersPage,
    database,
    product,
  }) => {
    // Setup — the admin to hand the product to, with the product open; seeded, it is nobody's.
    const adminId = await database.userId(TEST_USERS.admin)
    const { productDetail } = ordersPage.details
    await ordersPage.openProduct(product)

    // Act — pick the admin in the assignee picker, then open the order's history once the picker shows them.
    await productDetail.assignee.click()
    await productDetail.assigneeOption(adminId).click()
    await productDetail.assignedTo(adminId).waitFor()
    await ordersPage.details.historyTab.click()

    // Assert — one assignee change on record, and its sentence names who the product went to.
    const assigneeChanges = ordersPage.details.history.ofType(ASSIGNEE_CHANGED_HISTORY_EVENT)
    await expect(assigneeChanges).toHaveCount(1)
    await expect(assigneeChanges).toContainText(TEST_USERS.admin.name)
  })
})

test.describe('in progress, product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('PRD-STA-010 marking the product as done moves it to done', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — mark it done and confirm. Its order's last product, so the order
    // finishes on its own a moment later, with a history entry of its own;
    // wait for that, or the order's removal after the test races the write.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.inStatus(FINISHED_STATUS).waitFor()

    // Assert — the product is done.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', DONE_STATUS)
  })

  test('PRD-STA-016 marking the product as done records it in the order history', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — mark it done and confirm, then open the order's history once the order has finished with it.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.inStatus(FINISHED_STATUS).waitFor()
    await ordersPage.details.historyTab.click()

    // Assert — the history holds the step, once.
    await expect(ordersPage.details.history.ofType(MARKED_DONE_HISTORY_EVENT)).toHaveCount(1)
  })

  test('PRD-STA-017 sending the product back to pre-press records the return in the order history', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — go back to pre-press from the banner, then open the order's history once the product is there.
    await ordersPage.details.productDetail.backToPrepress.click()
    await ordersPage.details.productList.rowInStatus(product.id, PREPRESS_STATUS).waitFor()
    await ordersPage.details.historyTab.click()

    // Assert — the history holds the return, once.
    await expect(ordersPage.details.history.ofType(RETURNED_TO_PREPRESS_HISTORY_EVENT)).toHaveCount(1)
  })
})

// ── Stage defaults ────────────────────────────────────────────────────────
// The fixture puts the admin into one stage's slot of the product's
// department. Seeded products carry no assignee and the suite runs as the
// employee, so the admin can only hold the product through the default.

test.describe('in progress, OTHER product, pre-press default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: OTHER_PRODUCT, departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  // `departmentDefault` is listed before `product` on purpose: Playwright sets
  // fixtures up in parameter order, and the database promotes the product the
  // moment it is inserted — the slot has to be filled by then.
  test('PRD-STA-011 the product promoted to pre-press is assigned to the pre-press default', async ({ ordersPage, departmentDefault, product }) => {
    // Setup — the product open; the database promoted it when it was seeded.
    await ordersPage.openProduct(product)

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})

test.describe('in progress, product in pre-press, production default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, departmentDefaultSeed: ADMIN_AS_PRODUCTION_DEFAULT })

  test('PRD-STA-012 releasing the product to production assigns it to the production default', async ({ ordersPage, product, departmentDefault }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — release it and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the production default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })

  // `departmentDefault` is requested for its side effect: without it the slot stays empty and nothing is logged.
  test('PRD-STA-013 releasing the product to production records the assignee change in the order history', async ({ ordersPage, product, departmentDefault: _productionDefault }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — release it and confirm, then open the history.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.historyTab.click()

    // Assert — the history holds the assignee change.
    await expect(ordersPage.details.history.ofType(ASSIGNEE_CHANGED_HISTORY_EVENT)).toHaveCount(1)
  })
})

test.describe('in progress, product in production, pre-press default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION, departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  test('PRD-STA-014 sending the product back to pre-press assigns it to the pre-press default', async ({ ordersPage, product, departmentDefault }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — go back to pre-press from the banner.
    await ordersPage.details.productDetail.backToPrepress.click()

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})
