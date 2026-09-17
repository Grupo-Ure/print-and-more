import { expect, test, IN_PROGRESS_ORDER } from '../../fixtures/stock'
import {
  STAMP_JOB_IN_PREPRESS_IN_STOCK,
  TEXTILE_JOB_IN_PREPRESS_IN_STOCK,
  IN_STOCK_STAMP_PRODUCT_ROW,
  OWN_STOCK_GARMENT_ROW,
  DONE_STATUS,
} from '../../fixtures/jobs'
import { IN_STOCK_STAMP_MODEL } from '../../fixtures/stamps'
import { IN_STOCK_TEXTILE_CHAIN } from '../../fixtures/textiles'
import { TEST_USERS } from '../../fixtures/users'

// The stock pages are admin-only, so every test here runs as the admin.
test.use({ user: TEST_USERS.admin })

test.describe('in progress, stamp job in pre-press, model in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: STAMP_JOB_IN_PREPRESS_IN_STOCK })

  test('releasing the job to production deducts the product quantity from the model stock', async ({ ordersPage, navbar, stampStockPage, order, job }) => {
    // Setup — the stock the model is left with, and its row on the stock page.
    const remaining = IN_STOCK_STAMP_MODEL.stock - IN_STOCK_STAMP_PRODUCT_ROW.quantity
    const modelRow = stampStockPage.table.row(IN_STOCK_STAMP_MODEL.id)

    // Act — open the order and the job, release it and confirm, then find the model on the stamp stock page.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobDetail.releaseButtonTo(DONE_STATUS).waitFor()
    await navbar.link('stampStock').click()
    await stampStockPage.search.fill(IN_STOCK_STAMP_MODEL.name)

    // Assert — the model's stock went down by the quantity.
    await expect(stampStockPage.table.rowStock(modelRow)).toHaveAttribute('data-stock', String(remaining))
  })

  test('marking the job done after the release deducts nothing more', async ({ ordersPage, navbar, stampStockPage, order, job }) => {
    // Setup — the stock the model is left with, and its row on the stock page.
    const remaining = IN_STOCK_STAMP_MODEL.stock - IN_STOCK_STAMP_PRODUCT_ROW.quantity
    const modelRow = stampStockPage.table.row(IN_STOCK_STAMP_MODEL.id)

    // Act — release the job, then mark it done, each confirmed, then find the model on the stamp stock page.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobDetail.releaseButtonTo(DONE_STATUS).click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobList.rowInStatus(job.id, DONE_STATUS).waitFor()
    await navbar.link('stampStock').click()
    await stampStockPage.search.fill(IN_STOCK_STAMP_MODEL.name)

    // Assert — still only the one deduction.
    await expect(stampStockPage.table.rowStock(modelRow)).toHaveAttribute('data-stock', String(remaining))
  })
})

test.describe('in progress, textile job in pre-press, variant in stock', () => {
  test.use({ orderSeed: IN_PROGRESS_ORDER, jobSeed: TEXTILE_JOB_IN_PREPRESS_IN_STOCK })

  test('releasing the job to production deducts the garment quantity from the variant stock', async ({ ordersPage, navbar, textileStockPage, order, job }) => {
    // Setup — the stock the variant is left with, and its row on the stock page.
    const remaining = IN_STOCK_TEXTILE_CHAIN.variant.stock - OWN_STOCK_GARMENT_ROW.quantity
    const variantRow = textileStockPage.table.row(IN_STOCK_TEXTILE_CHAIN.variant.id)

    // Act — open the order and the job, release it and confirm, then find the variant on the textile stock page.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobDetail.releaseButtonTo(DONE_STATUS).waitFor()
    await navbar.link('textileStock').click()
    await textileStockPage.search.fill(IN_STOCK_TEXTILE_CHAIN.brand.name)

    // Assert — the variant's stock went down by the quantity.
    await expect(textileStockPage.table.rowStock(variantRow)).toHaveAttribute('data-stock', String(remaining))
  })

  test('marking the job done after the release deducts nothing more', async ({ ordersPage, navbar, textileStockPage, order, job }) => {
    // Setup — the stock the variant is left with, and its row on the stock page.
    const remaining = IN_STOCK_TEXTILE_CHAIN.variant.stock - OWN_STOCK_GARMENT_ROW.quantity
    const variantRow = textileStockPage.table.row(IN_STOCK_TEXTILE_CHAIN.variant.id)

    // Act — release the job, then mark it done, each confirmed, then find the variant on the textile stock page.
    await ordersPage.sidebar.row(order.id).click()
    await ordersPage.details.jobList.row(job.id).click()
    await ordersPage.details.jobDetail.releaseButton.click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobDetail.releaseButtonTo(DONE_STATUS).click()
    await ordersPage.confirmDialog.confirm.click()
    await ordersPage.details.jobList.rowInStatus(job.id, DONE_STATUS).waitFor()
    await navbar.link('textileStock').click()
    await textileStockPage.search.fill(IN_STOCK_TEXTILE_CHAIN.brand.name)

    // Assert — still only the one deduction.
    await expect(textileStockPage.table.rowStock(variantRow)).toHaveAttribute('data-stock', String(remaining))
  })
})
