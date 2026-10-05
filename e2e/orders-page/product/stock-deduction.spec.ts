import { expect, test, IN_PROGRESS_ORDER } from '../../fixtures/stock'
import {
  STAMP_PRODUCT_IN_PREPRESS_IN_STOCK,
  TEXTILE_BATCH_IN_PREPRESS_IN_STOCK,
  IN_STOCK_STAMP_PRODUCT,
  TEXTILE_GARMENT_QUANTITY,
  DONE_STATUS,
} from '../../fixtures/products'
import { IN_STOCK_STAMP_MODEL } from '../../fixtures/stamps'
import { IN_STOCK_TEXTILE_CHAIN } from '../../fixtures/textiles'
import { TEST_USERS } from '../../fixtures/users'

// The stock pages are admin-only, so every test here runs as the admin.
test.use({ user: TEST_USERS.admin })

test.describe('in progress, stamp product in pre-press, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: STAMP_PRODUCT_IN_PREPRESS_IN_STOCK })

  test('releasing the product to production deducts its quantity from the model stock', async ({ ordersPage, navbar, stampStockPage, product }) => {
    // Setup — the stock the model is left with and its row on the stock page, with the product open.
    const remaining = IN_STOCK_STAMP_MODEL.stock - (IN_STOCK_STAMP_PRODUCT.quantity ?? 0)
    const modelRow = stampStockPage.table.row(IN_STOCK_STAMP_MODEL.id)
    await ordersPage.openProduct(product)

    // Act — release it and confirm, then find the model on the stamp stock page.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productDetail.releaseButtonTo(DONE_STATUS).waitFor()
    await navbar.link('stampStock').click()
    await stampStockPage.search.fill(IN_STOCK_STAMP_MODEL.name)

    // Assert — the model's stock went down by the quantity.
    await expect(stampStockPage.table.rowStock(modelRow)).toHaveAttribute('data-stock', String(remaining))
  })

  test('marking the product done after the release deducts nothing more', async ({ ordersPage, navbar, stampStockPage, product }) => {
    // Setup — the stock the model is left with and its row on the stock page, with the product open.
    const remaining = IN_STOCK_STAMP_MODEL.stock - (IN_STOCK_STAMP_PRODUCT.quantity ?? 0)
    const modelRow = stampStockPage.table.row(IN_STOCK_STAMP_MODEL.id)
    await ordersPage.openProduct(product)

    // Act — release it, then mark it done, each confirmed, then find the model on the stamp stock page.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productDetail.releaseButtonTo(DONE_STATUS).click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productList.rowInStatus(product.id, DONE_STATUS).waitFor()
    await navbar.link('stampStock').click()
    await stampStockPage.search.fill(IN_STOCK_STAMP_MODEL.name)

    // Assert — still only the one deduction.
    await expect(stampStockPage.table.rowStock(modelRow)).toHaveAttribute('data-stock', String(remaining))
  })
})

test.describe('in progress, textile batch in pre-press, variant in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, productSeed: TEXTILE_BATCH_IN_PREPRESS_IN_STOCK })

  test("releasing the batch to production deducts its garment line's quantity from the variant stock", async ({ ordersPage, navbar, textileStockPage, product }) => {
    // Setup — the stock the variant is left with and its row on the stock page, with the product open.
    const remaining = IN_STOCK_TEXTILE_CHAIN.variant.stock - TEXTILE_GARMENT_QUANTITY
    const variantRow = textileStockPage.table.row(IN_STOCK_TEXTILE_CHAIN.variant.id)
    await ordersPage.openProduct(product)

    // Act — release it and confirm, then find the variant on the textile stock page.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productDetail.releaseButtonTo(DONE_STATUS).waitFor()
    await navbar.link('textileStock').click()
    await textileStockPage.search.fill(IN_STOCK_TEXTILE_CHAIN.brand.name)

    // Assert — the variant's stock went down by the line's quantity.
    await expect(textileStockPage.table.rowStock(variantRow)).toHaveAttribute('data-stock', String(remaining))
  })

  test('marking the batch done after the release deducts nothing more', async ({ ordersPage, navbar, textileStockPage, product }) => {
    // Setup — the stock the variant is left with and its row on the stock page, with the product open.
    const remaining = IN_STOCK_TEXTILE_CHAIN.variant.stock - TEXTILE_GARMENT_QUANTITY
    const variantRow = textileStockPage.table.row(IN_STOCK_TEXTILE_CHAIN.variant.id)
    await ordersPage.openProduct(product)

    // Act — release it, then mark it done, each confirmed, then find the variant on the textile stock page.
    await ordersPage.details.productDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productDetail.releaseButtonTo(DONE_STATUS).click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.productList.rowInStatus(product.id, DONE_STATUS).waitFor()
    await navbar.link('textileStock').click()
    await textileStockPage.search.fill(IN_STOCK_TEXTILE_CHAIN.brand.name)

    // Assert — still only the one deduction.
    await expect(textileStockPage.table.rowStock(variantRow)).toHaveAttribute('data-stock', String(remaining))
  })
})
