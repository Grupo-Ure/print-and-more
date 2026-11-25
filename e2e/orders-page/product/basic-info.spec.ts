import { expect, test, IN_PROGRESS_ORDER, missedOrderDeadline } from '../../fixtures/orders'
import {
  OTHER_PRODUCT_FORM,
  EDITED_OTHER_DESCRIPTION,
  EDITED_OTHER_QUANTITY,
  PRODUCT_IN_PRODUCTION,
  PRODUCT_UPDATED_HISTORY_EVENT,
  TEST_PRODUCT_CHILD_TABLE,
  otherProductEdit,
  otherProductRow,
} from '../../fixtures/products'
import { TEST_USERS } from '../../fixtures/users'

// The Basic info tab is the product's own per-type form, inline: read-only
// until Edit is pressed, and read-only for good once the product is released.
// The release lock is the database's rule, not the form's: the form only hides
// what a write as the signed-in user would be refused.

test("PRD-INF-001 the product's saved spec is shown read-only, with no way to submit it", async ({ ordersPage, product }) => {
  // Setup — the product open on its Basic info tab (the default); the `product` fixture inserted its spec.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Assert — the spec is on screen, with the form closed and Edit on offer.
  await expect(basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
  await expect(basicInfo.submit).toHaveCount(0)
  await expect(basicInfo.edit).toBeVisible()
})

test('PRD-INF-002 editing the description and saving it shows the new value on the closed form', async ({ ordersPage, product }) => {
  // Setup — the product open on its Basic info tab.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Act — open the form, replace the description and save.
  await basicInfo.edit.click()
  await basicInfo.field('description').fill(EDITED_OTHER_DESCRIPTION)
  await basicInfo.submit.click()

  // Assert — the form closed again and carries the saved value.
  await expect(basicInfo.submit).toHaveCount(0)
  await expect(basicInfo.field('description')).toHaveValue(EDITED_OTHER_DESCRIPTION)
})

test('PRD-INF-007 saving an edited description records the specification before and after in the order history', async ({
  ordersPage,
  database,
  product,
}) => {
  // Setup — the product open on its Basic info tab.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Act — open the form, replace the description and save, then open the order's history once the form has closed.
  await basicInfo.edit.click()
  await basicInfo.field('description').fill(EDITED_OTHER_DESCRIPTION)
  await basicInfo.submit.click()
  await basicInfo.submit.waitFor({ state: 'detached' })
  await ordersPage.details.historyTab.click()

  // Assert — the history shows one change, and it holds the description as it was before and as it is after.
  await expect(ordersPage.details.history.ofType(PRODUCT_UPDATED_HISTORY_EVENT)).toHaveCount(1)
  const changes = await database.productSpecChanges(product.orderId)
  const [change] = changes
  expect(changes).toHaveLength(1)
  expect(change.before.description).toBe(OTHER_PRODUCT_FORM.description)
  expect(change.after.description).toBe(EDITED_OTHER_DESCRIPTION)
})

test('PRD-INF-008 saving the form unchanged writes no history entry', async ({ ordersPage, database, product }) => {
  // Setup — the product open on its Basic info tab.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Act — open the form and save it without touching a field; wait for it to close.
  await basicInfo.edit.click()
  await basicInfo.submit.click()
  await basicInfo.submit.waitFor({ state: 'detached' })

  // Assert — a save that changed nothing is not on record.
  expect(await database.historyCount(product.orderId, PRODUCT_UPDATED_HISTORY_EVENT)).toBe(0)
})

test('PRD-INF-003 cancelling an edit leaves the saved description in place', async ({ ordersPage, product }) => {
  // Setup — the product open on its Basic info tab.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Act — open the form, change the description and cancel.
  await basicInfo.edit.click()
  await basicInfo.field('description').fill(EDITED_OTHER_DESCRIPTION)
  await basicInfo.cancel.click()

  // Assert — the draft is discarded; the form shows what was saved.
  await expect(basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
})

test.describe("with the product's spec in edit mode and a description typed", () => {
  test('PRD-INF-009 an edit in progress keeps its unsaved input when the product is changed outside the app', async ({
    ordersPage,
    database,
    product,
  }) => {
    // Setup — the form open with a description typed and not saved.
    const { basicInfo } = ordersPage.details.productDetail
    const row = ordersPage.details.productList.row(product.id)
    await ordersPage.openProduct(product)
    await basicInfo.edit.click()
    await basicInfo.field('description').fill(EDITED_OTHER_DESCRIPTION)

    // Act — give the product a past deadline in the database, and wait until the view has taken it in: its row flags the missed deadline.
    await database.updateProductDeadline(product.id, missedOrderDeadline())
    await ordersPage.details.productList.rowDeadlineMissed(row).waitFor()

    // Assert — the refresh left what was being typed alone.
    await expect(basicInfo.field('description')).toHaveValue(EDITED_OTHER_DESCRIPTION)
  })
})

test("PRD-INF-011 writing an open product's typed spec row directly as the signed-in user is refused", async ({ database, product }) => {
  // Setup — a connection that writes as the employee, not as the runner; the default seed holds the product in setup.
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act — change the child row directly, around save_product.
  const { error } = await asEmployee
    .from(TEST_PRODUCT_CHILD_TABLE)
    .update({ description: EDITED_OTHER_DESCRIPTION })
    .eq('product_id', product.id)

  // Assert — refused although nothing is released yet, and the spec is as it was seeded.
  expect(error).not.toBeNull()
  expect(await database.productChild(TEST_PRODUCT_CHILD_TABLE, product.id)).toEqual(
    expect.objectContaining({ description: OTHER_PRODUCT_FORM.description }),
  )
})

test('PRD-INF-012 inserting a product row directly as the signed-in user is refused', async ({ database, order, product: _only }) => {
  // Setup — a connection that writes as the employee; the order holds the one product the fixture inserted.
  const asEmployee = await database.asUser(TEST_USERS.employee)

  // Act — insert a second product's parent row directly, around save_product.
  const { error } = await asEmployee.from('products').insert(otherProductRow(order.id))

  // Assert — refused, and the order still has its one product.
  expect(error).not.toBeNull()
  expect(await database.productCount(order.id)).toBe(1)
})

test.describe('in progress, product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('PRD-INF-004 the released product offers no way to edit its spec', async ({ ordersPage, product }) => {
    // Setup — the product open on its Basic info tab.
    const { basicInfo } = ordersPage.details.productDetail
    await ordersPage.openProduct(product)

    // Assert — the spec is readable but locked: released work is not corrected here.
    await expect(basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
    await expect(basicInfo.edit).toHaveCount(0)
  })

  test("PRD-INF-005 writing the released product's typed spec row as the signed-in user is refused", async ({
    database,
    product,
  }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — change the child row behind the locked form, bypassing the UI, then read it back.
    const { error } = await asEmployee
      .from(TEST_PRODUCT_CHILD_TABLE)
      .update({ description: EDITED_OTHER_DESCRIPTION })
      .eq('product_id', product.id)
    const { data: row } = await asEmployee
      .from(TEST_PRODUCT_CHILD_TABLE)
      .select('description')
      .eq('product_id', product.id)
      .single()

    // Assert — the write was refused, and the spec is as it was seeded.
    expect(error).not.toBeNull()
    expect(row?.description).toBe(OTHER_PRODUCT_FORM.description)
  })

  test("PRD-INF-006 writing the released product's quantity as the signed-in user is refused", async ({
    database,
    product,
  }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — change a spec column on the parent row, bypassing the UI, then read it back.
    const { error } = await asEmployee.from('products').update({ quantity: EDITED_OTHER_QUANTITY }).eq('id', product.id)
    const { data: row } = await asEmployee.from('products').select('quantity').eq('id', product.id).single()

    // Assert — the write was refused, and the spec is as it was seeded.
    expect(error).not.toBeNull()
    expect(row?.quantity).toBe(PRODUCT_IN_PRODUCTION.quantity)
  })

  test("PRD-INF-010 saving the released product's spec through save_product as the signed-in user is refused", async ({
    database,
    product,
  }) => {
    // Setup — a connection that writes as the employee, not as the runner.
    const asEmployee = await database.asUser(TEST_USERS.employee)

    // Act — an edit of the spec through the one function that saves a product.
    const { error } = await asEmployee.rpc('save_product', otherProductEdit(product.id))

    // Assert — the function keeps the lock itself: refused, and the description as seeded.
    expect(error).not.toBeNull()
    expect(await database.productChild(TEST_PRODUCT_CHILD_TABLE, product.id)).toEqual(
      expect.objectContaining({ description: OTHER_PRODUCT_FORM.description }),
    )
  })
})
