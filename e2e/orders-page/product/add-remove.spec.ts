import { expect, test, IN_PROGRESS_ORDER, IN_PROGRESS_ORDER_WITHOUT_DEADLINE, IN_PROGRESS_STATUS, FINISHED_STATUS } from '../../fixtures/orders'
import {
  TEST_PRODUCT_DEPARTMENT,
  OTHER_PRODUCT,
  OTHER_PRODUCT_FORM,
  POSTER_PRODUCT,
  PRODUCT_IN_PREPRESS,
  PRODUCT_DONE,
  PRODUCT_CANCELLED_HISTORY_EVENT,
  PRODUCT_CREATED_HISTORY_EVENT,
  firstTestProductNumber,
} from '../../fixtures/products'
import {
  BANNER_SAVE,
  BINDING_SAVE,
  BROCHURE_SAVE,
  BUSINESS_CARD_SAVE,
  CARD_FLYER_SAVE,
  DATE_STAMP_SAVE,
  FOIL_PLOTTER_SAVE,
  FOLDED_FLYER_SAVE,
  GIFT_ITEM_SAVE,
  INK_PAD_SAVE,
  NAME_TAG_SAVE,
  OTHER_LASER_SAVE,
  OTHER_LFP_SAVE,
  OTHER_SAVE,
  OTHER_STAMP_SAVE,
  POSTER_SAVE,
  PRINTOUT_SAVE,
  REFILL_INK_SAVE,
  ROLLUP_SAVE,
  SIGN_FOIL_SAVE,
  SIGN_SAVE,
  SIGN_UV_SAVE,
  STAMP_PLATE_SAVE,
  STAND_STAMP_SAVE,
  STICKER_SAVE,
  TEXTILE_BATCH_SAVE,
  TRODAT_PAD_SAVE,
  TRODAT_PRINTY_SAVE,
  TROPHY_PLATE_SAVE,
  VEHICLE_LETTERING_SAVE,
  WOODEN_STAMP_SAVE,
  singleChildSave,
  textileBatchSave,
} from '../../fixtures/productSaves'
import { TEST_USERS } from '../../fixtures/users'

// Adding a product is an unsaved draft in the detail pane, not an empty row in
// the database: a stored product always has a valid spec, so the department
// button leads to its type's own form and only the save creates the row. OTHER
// has one product type, so its button starts the draft without a type menu.

test('PRD-ADD-001 adding a product through its department form selects it in the list', async ({ ordersPage, order }) => {
  // Setup — the number the database assigns to the order's first product of this department, with the order open.
  const productNumber = firstTestProductNumber(order.orderNumber)
  const { productList, productDraft, productDetail } = ordersPage.details
  await ordersPage.openOrder(order.id)

  // Act — start the department's draft and save the product its form describes.
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()
  await productDraft.field('description').fill(OTHER_PRODUCT_FORM.description)
  await productDraft.field('quantity').fill(OTHER_PRODUCT_FORM.quantity)
  await productDraft.submit.click()

  // Assert — the draft is gone, the list marks a row active and the detail shows the new product's number.
  await expect(productDraft.root).toHaveCount(0)
  await expect(productList.selectedRow).toBeVisible()
  await expect(productDetail.title).toContainText(productNumber)
})

test('PRD-ADD-011 adding a product records its creation in the order history, with its full specification', async ({
  ordersPage,
  database,
  order,
}) => {
  // Setup — the order open.
  const { productList, productDraft } = ordersPage.details
  await ordersPage.openOrder(order.id)

  // Act — save a product through the department's form, then open the order's history once the draft is gone.
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()
  await productDraft.field('description').fill(OTHER_PRODUCT_FORM.description)
  await productDraft.field('quantity').fill(OTHER_PRODUCT_FORM.quantity)
  await productDraft.submit.click()
  await productDraft.root.waitFor({ state: 'detached' })
  await ordersPage.details.historyTab.click()

  // Assert — the history shows the creation, and the one entry stored holds the spec as typed.
  await expect(ordersPage.details.history.ofType(PRODUCT_CREATED_HISTORY_EVENT)).toHaveCount(1)
  expect(await database.recordedEntries(order.id, PRODUCT_CREATED_HISTORY_EVENT)).toEqual([
    expect.objectContaining({
      meta: expect.objectContaining({
        after: expect.objectContaining({ spec: expect.objectContaining({ description: OTHER_PRODUCT_FORM.description }) }),
      }),
    }),
  ])
})

test('PRD-ADD-002 the draft product is listed while it is being filled in', async ({ ordersPage, order }) => {
  // Setup — the order open, with no product in it yet.
  const { productList } = ordersPage.details
  await ordersPage.openOrder(order.id)

  // Act — start the department's draft.
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()

  // Assert — the list shows the unsaved product as a row of its department.
  await expect(productList.draftRow).toHaveAttribute('data-department', TEST_PRODUCT_DEPARTMENT)
})

test('PRD-ADD-003 cancelling the draft product adds nothing to the order', async ({ ordersPage, order }) => {
  // Setup — the draft open on the department's only product type.
  const { productList, productDraft } = ordersPage.details
  await ordersPage.openOrder(order.id)
  await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()

  // Act — cancel without filling the form in (the click waits for the form).
  await productDraft.cancel.click()

  // Assert — the draft is gone and the order has no product.
  await expect(productDraft.root).toHaveCount(0)
  await expect(productList.empty).toBeVisible()
})

test('PRD-ADD-004 a department of several product types offers them before the draft starts', async ({ ordersPage, order }) => {
  // Setup — the order open; CopyShop offers several types, so its button opens a menu.
  const { productList, productDraft } = ordersPage.details
  await ordersPage.openOrder(order.id)

  // Act — open the department's type menu and pick one of its types.
  await productList.addProduct(POSTER_PRODUCT.department).click()
  await productList.addProductType(POSTER_PRODUCT.type).click()

  // Assert — the draft opens on the picked type's form.
  await expect(productDraft.root).toHaveAttribute('data-type', POSTER_PRODUCT.type)
})

test.describe('in progress, its only product done', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_DONE })

  test('PRD-ADD-005 a draft product does not count as work still open on the order', async ({ ordersPage, order, product }) => {
    // Setup — the order open with its done product loaded, so it offers to be marked finished.
    const { productList, productDraft } = ordersPage.details
    await ordersPage.openOrder(order.id)
    await productList.row(product.id).waitFor()

    // Act — start a draft product.
    await productList.addProduct(TEST_PRODUCT_DEPARTMENT).click()

    // Assert — the unsaved product is no product of the order: it neither withdraws
    // the lifecycle action nor moves the order off in progress.
    await productDraft.root.waitFor()
    await expect(ordersPage.details.lifecycle).toHaveAttribute('data-target', FINISHED_STATUS)
    await expect(ordersPage.details.forOrder(order.id)).toHaveAttribute('data-status', IN_PROGRESS_STATUS)
  })
})

test('PRD-ADD-006 deleting a product in setup removes it from the order entirely', async ({ ordersPage, product }) => {
  // Setup — the product open; the default quote seed holds it in setup.
  await ordersPage.openProduct(product)

  // Act — delete it and confirm, then open the history's product filter.
  await ordersPage.details.productDetail.deleteButton.click()
  await ordersPage.confirmDialog.confirm.click()
  await ordersPage.details.historyTab.click()
  await ordersPage.details.history.productFilter.click()

  // Assert — the filter offers every product the order still has, a cancelled
  // one struck through; a deleted product is not among them.
  await expect(ordersPage.details.history.productOption(product.id)).toHaveCount(0)
})

test.describe('in progress, product in pre-press', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PREPRESS })

  test('PRD-ADD-007 cancelling a product past setup removes it from the order and records the cancellation', async ({ ordersPage, product }) => {
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

  test('PRD-ADD-008 cancelling the only product leaves the order in progress', async ({ ordersPage, order, product }) => {
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

  test('PRD-ADD-009 cancelling the pre-press product finishes the order on its own', async ({ ordersPage, order, products }) => {
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
  // No deadline on the order, so the setup product is not ready for pre-press
  // and the database leaves it there — where it can still be deleted.
  test.use({
    orderSeed: IN_PROGRESS_ORDER_WITHOUT_DEADLINE,
    productSeeds: [[PRODUCT_DONE, OTHER_PRODUCT], { scope: 'test' }],
  })

  test('PRD-ADD-010 deleting the setup product finishes the order on its own', async ({ ordersPage, order, products }) => {
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

// ── Saving one product of every type ──────────────────────────────────────
// Driven against the database, no screen involved: the employee's session
// calls `save_product` with what the type's form maps to, and the children it
// wrote are read back through the runner's connection. One case per product
// type, since each type is written to a table of its own.

test('PRD-ADD-012 saving a poster through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, POSTER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(POSTER_SAVE.childTable, productId)).toEqual(expect.objectContaining(POSTER_SAVE.child))
})

test('PRD-ADD-013 saving a card flyer through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, CARD_FLYER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(CARD_FLYER_SAVE.childTable, productId)).toEqual(expect.objectContaining(CARD_FLYER_SAVE.child))
})

test('PRD-ADD-014 saving a folded flyer through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, FOLDED_FLYER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(FOLDED_FLYER_SAVE.childTable, productId)).toEqual(expect.objectContaining(FOLDED_FLYER_SAVE.child))
})

test('PRD-ADD-015 saving a brochure through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, BROCHURE_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(BROCHURE_SAVE.childTable, productId)).toEqual(expect.objectContaining(BROCHURE_SAVE.child))
})

test('PRD-ADD-016 saving a business card through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, BUSINESS_CARD_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(BUSINESS_CARD_SAVE.childTable, productId)).toEqual(expect.objectContaining(BUSINESS_CARD_SAVE.child))
})

test('PRD-ADD-017 saving a binding through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, BINDING_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(BINDING_SAVE.childTable, productId)).toEqual(expect.objectContaining(BINDING_SAVE.child))
})

test('PRD-ADD-018 saving a printout through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, PRINTOUT_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(PRINTOUT_SAVE.childTable, productId)).toEqual(expect.objectContaining(PRINTOUT_SAVE.child))
})

test('PRD-ADD-019 saving a Trodat Printy stamp through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, TRODAT_PRINTY_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(TRODAT_PRINTY_SAVE.childTable, productId)).toEqual(expect.objectContaining(TRODAT_PRINTY_SAVE.child))
})

test('PRD-ADD-020 saving a wooden stamp through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, WOODEN_STAMP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(WOODEN_STAMP_SAVE.childTable, productId)).toEqual(expect.objectContaining(WOODEN_STAMP_SAVE.child))
})

test('PRD-ADD-021 saving a stand stamp through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, STAND_STAMP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(STAND_STAMP_SAVE.childTable, productId)).toEqual(expect.objectContaining(STAND_STAMP_SAVE.child))
})

test('PRD-ADD-022 saving a date stamp through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, DATE_STAMP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(DATE_STAMP_SAVE.childTable, productId)).toEqual(expect.objectContaining(DATE_STAMP_SAVE.child))
})

test('PRD-ADD-023 saving an other stamp through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, OTHER_STAMP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(OTHER_STAMP_SAVE.childTable, productId)).toEqual(expect.objectContaining(OTHER_STAMP_SAVE.child))
})

test('PRD-ADD-024 saving a stamp plate through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, STAMP_PLATE_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(STAMP_PLATE_SAVE.childTable, productId)).toEqual(expect.objectContaining(STAMP_PLATE_SAVE.child))
})

test('PRD-ADD-025 saving a refill ink through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, REFILL_INK_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(REFILL_INK_SAVE.childTable, productId)).toEqual(expect.objectContaining(REFILL_INK_SAVE.child))
})

test('PRD-ADD-026 saving an ink pad through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, INK_PAD_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(INK_PAD_SAVE.childTable, productId)).toEqual(expect.objectContaining(INK_PAD_SAVE.child))
})

test('PRD-ADD-027 saving a Trodat replacement pad through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, TRODAT_PAD_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(TRODAT_PAD_SAVE.childTable, productId)).toEqual(expect.objectContaining(TRODAT_PAD_SAVE.child))
})

test('PRD-ADD-028 saving a sticker through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, STICKER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(STICKER_SAVE.childTable, productId)).toEqual(expect.objectContaining(STICKER_SAVE.child))
})

test('PRD-ADD-029 saving a UV-printed sign through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, SIGN_UV_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(SIGN_UV_SAVE.childTable, productId)).toEqual(expect.objectContaining(SIGN_UV_SAVE.child))
})

test('PRD-ADD-030 saving a foil sign through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, SIGN_FOIL_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(SIGN_FOIL_SAVE.childTable, productId)).toEqual(expect.objectContaining(SIGN_FOIL_SAVE.child))
})

test('PRD-ADD-031 saving a plotted foil through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, FOIL_PLOTTER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(FOIL_PLOTTER_SAVE.childTable, productId)).toEqual(expect.objectContaining(FOIL_PLOTTER_SAVE.child))
})

test('PRD-ADD-032 saving a banner through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, BANNER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(BANNER_SAVE.childTable, productId)).toEqual(expect.objectContaining(BANNER_SAVE.child))
})

test('PRD-ADD-033 saving a roll-up through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, ROLLUP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(ROLLUP_SAVE.childTable, productId)).toEqual(expect.objectContaining(ROLLUP_SAVE.child))
})

test('PRD-ADD-034 saving a vehicle lettering through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, VEHICLE_LETTERING_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(VEHICLE_LETTERING_SAVE.childTable, productId)).toEqual(expect.objectContaining(VEHICLE_LETTERING_SAVE.child))
})

test('PRD-ADD-035 saving an other large-format product through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, OTHER_LFP_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(OTHER_LFP_SAVE.childTable, productId)).toEqual(expect.objectContaining(OTHER_LFP_SAVE.child))
})

test('PRD-ADD-036 saving an engraved sign through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, SIGN_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(SIGN_SAVE.childTable, productId)).toEqual(expect.objectContaining(SIGN_SAVE.child))
})

test('PRD-ADD-037 saving a trophy plate through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, TROPHY_PLATE_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(TROPHY_PLATE_SAVE.childTable, productId)).toEqual(expect.objectContaining(TROPHY_PLATE_SAVE.child))
})

test('PRD-ADD-038 saving a name tag through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, NAME_TAG_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(NAME_TAG_SAVE.childTable, productId)).toEqual(expect.objectContaining(NAME_TAG_SAVE.child))
})

test('PRD-ADD-039 saving a gift item through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, GIFT_ITEM_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(GIFT_ITEM_SAVE.childTable, productId)).toEqual(expect.objectContaining(GIFT_ITEM_SAVE.child))
})

test('PRD-ADD-040 saving an other laser product through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, OTHER_LASER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(OTHER_LASER_SAVE.childTable, productId)).toEqual(expect.objectContaining(OTHER_LASER_SAVE.child))
})

test('PRD-ADD-041 saving an other product through save_product stores its specification', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', singleChildSave(order.id, OTHER_SAVE))

  // Assert — the type's own table holds the row as handed in.
  expect(await database.productChild(OTHER_SAVE.childTable, productId)).toEqual(expect.objectContaining(OTHER_SAVE.child))
})

test('PRD-ADD-042 saving a textile batch through save_product stores its garment lines and designs', async ({ database, order }) => {
  // Setup
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act
  const { data: productId } = await asEmployee.rpc('save_product', textileBatchSave(order.id, TEXTILE_BATCH_SAVE))

  // Assert — the batch has no single child: its lines and its designs hold what was handed in.
  const batch = await database.textileBatch(productId)
  expect(batch.garments).toEqual(TEXTILE_BATCH_SAVE.garments.map(line => expect.objectContaining(line)))
  expect(batch.designs).toEqual(TEXTILE_BATCH_SAVE.designs.map(design => expect.objectContaining(design)))
})
