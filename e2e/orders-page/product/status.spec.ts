import {
  expect,
  test,
  nextOrderDeadline,
  IN_PROGRESS_ORDER,
  IN_PROGRESS_ORDER_WITHOUT_DEADLINE,
  IN_PROGRESS_ORDER_PAST_DEADLINE,
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
} from '../../fixtures/products'
import {
  ADMIN_AS_PREPRESS_DEFAULT,
  ADMIN_AS_PRODUCTION_DEFAULT,
  ASSIGNEE_CHANGED_HISTORY_EVENT,
} from '../../fixtures/departments'

test.describe('in progress, product without a deadline', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE, productSeed: POSTER_PRODUCT })

  test('setting the order deadline completes the product and promotes it to pre-press', async ({ ordersPage, order, product }) => {
    // Setup — a date the picker accepts, with the order open.
    const deadline = nextOrderDeadline()
    const picker = ordersPage.details.deadline
    await ordersPage.openOrder(order.id)

    // Act — pick the deadline, the product's last missing requirement.
    await picker.trigger.click()
    await picker.showMonthOf(deadline)
    await picker.day(deadline).click()

    // Assert — the product advanced on its own.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

// ── Auto-promotion, one department at a time ──────────────────────────────
// Each fixture seeds the product in setup in an order that supplies the
// deadline it inherits; opening it must find it already promoted. One block
// per department, so a department that stops advancing is named in the report.

test.describe('in progress, LFP product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: BANNER_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, CopyShop product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: POSTER_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, textile batch', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: SHOP_SUPPLIED_TEXTILE_BATCH })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, stamp product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: IN_STOCK_STAMP_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, laser-engraving product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: SIGN_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, OTHER product', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: OTHER_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — it advanced without a release.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

test.describe('in progress, product whose deadline has passed', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER_PAST_DEADLINE, productSeed: POSTER_PRODUCT })

  test('the product is promoted to pre-press on its own', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Assert — a past deadline does not hold it back.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', PREPRESS_STATUS)
  })
})

// ── The manual steps after pre-press ──────────────────────────────────────

test.describe('in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('releasing the product to production moves it to in production', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — release it and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is in production.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', IN_PRODUCTION_STATUS)
  })
})

test.describe('in progress, product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('marking the product as done moves it to done', async ({ ordersPage, product }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — mark it done and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the product is done.
    await expect(ordersPage.details.productList.row(product.id)).toHaveAttribute('data-status', DONE_STATUS)
  })
})

// ── Stage defaults ────────────────────────────────────────────────────────
// The fixture puts the admin into one stage's slot of the product's
// department. Seeded products carry no assignee and the suite runs as the
// employee, so the admin can only hold the product through the default.

test.describe('in progress, OTHER product, pre-press default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: OTHER_PRODUCT, departmentDefaultSeed: ADMIN_AS_PREPRESS_DEFAULT })

  test('the product promoted to pre-press is assigned to the pre-press default', async ({ ordersPage, product, departmentDefault }) => {
    // Setup — the product open; it is promoted on the way.
    await ordersPage.openProduct(product)

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})

test.describe('in progress, product in pre-press, production default set', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS, departmentDefaultSeed: ADMIN_AS_PRODUCTION_DEFAULT })

  test('releasing the product to production assigns it to the production default', async ({ ordersPage, product, departmentDefault }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — release it and confirm.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()

    // Assert — the production default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })

  // `departmentDefault` is requested for its side effect: without it the slot stays empty and nothing is logged.
  test('releasing the product to production records the assignee change in the order history', async ({ ordersPage, product, departmentDefault: _productionDefault }) => {
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

  test('sending the product back to pre-press assigns it to the pre-press default', async ({ ordersPage, product, departmentDefault }) => {
    // Setup — the product open.
    await ordersPage.openProduct(product)

    // Act — go back to pre-press from the banner.
    await ordersPage.details.productDetail.backToPrepress.click()

    // Assert — the pre-press default holds it.
    await expect(ordersPage.details.productDetail.assignee).toHaveAttribute('data-value', departmentDefault.userId ?? '')
  })
})
