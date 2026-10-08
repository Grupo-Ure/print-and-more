import { expect, test, IN_PROGRESS_ORDER } from '../../fixtures/orders'
import {
  OTHER_PRODUCT_FORM,
  EDITED_OTHER_DESCRIPTION,
  EDITED_OTHER_QUANTITY,
  PRODUCT_IN_PRODUCTION,
  TEST_PRODUCT_CHILD_TABLE,
} from '../../fixtures/products'
import { TEST_USERS } from '../../fixtures/users'

// The Basic info tab is the product's own per-type form, inline: read-only
// until Edit is pressed, and read-only for good once the product is released.
// The release lock is the database's rule, not the form's: the form only hides
// what a write as the signed-in user would be refused.

test("the product's saved spec is shown read-only, with no way to submit it", async ({ ordersPage, product }) => {
  // Setup — the product open on its Basic info tab (the default); the `product` fixture inserted its spec.
  const { basicInfo } = ordersPage.details.productDetail
  await ordersPage.openProduct(product)

  // Assert — the spec is on screen, with the form closed and Edit on offer.
  await expect(basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
  await expect(basicInfo.submit).toHaveCount(0)
  await expect(basicInfo.edit).toBeVisible()
})

test('editing the description and saving it shows the new value on the closed form', async ({ ordersPage, product }) => {
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

test('cancelling an edit leaves the saved description in place', async ({ ordersPage, product }) => {
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

test.describe('in progress, product in production', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: PRODUCT_IN_PRODUCTION })

  test('the released product offers no way to edit its spec', async ({ ordersPage, product }) => {
    // Setup — the product open on its Basic info tab.
    const { basicInfo } = ordersPage.details.productDetail
    await ordersPage.openProduct(product)

    // Assert — the spec is readable but locked: released work is not corrected here.
    await expect(basicInfo.field('description')).toHaveValue(OTHER_PRODUCT_FORM.description)
    await expect(basicInfo.edit).toHaveCount(0)
  })

  test("writing the released product's typed spec row as the signed-in user is refused", async ({
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

  test("writing the released product's quantity as the signed-in user is refused", async ({
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
})
