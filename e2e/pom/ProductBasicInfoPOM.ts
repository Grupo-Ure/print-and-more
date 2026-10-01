import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.orders.productDetail.basicInfo

/**
 * The product's **Basic info** tab: its own per-type form, read-only until
 * *Edit* is pressed and read-only for good once the product is in production.
 * Carries `data-type`. The inputs share one test ID whatever the product type
 * and carry the form field name in `data-field`, so a spec addresses them by
 * name.
 */
export class ProductBasicInfoPOM extends BasePOM {
  readonly root: Locator
  /** Switches the form from read-only to editable (absent once locked). */
  readonly edit: Locator
  /** Every form input; each carries `data-field`. */
  readonly fields: Locator
  readonly submit: Locator
  readonly cancel: Locator
  /** The textile batch editor, present only for a TEXTILE_GARMENT product. */
  readonly textile: TextileBatchEditorPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.edit = this.root.getByTestId(IDS.edit)
    this.fields = this.root.getByTestId(IDS.field)
    this.submit = this.root.getByTestId(IDS.submit)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.textile = new TextileBatchEditorPOM(page, this.root)
  }

  field(name: string): Locator {
    return this.withAttr(this.fields, 'data-field', name)
  }
}

/**
 * The textile product's basic-info form: the batch's garment lines as a size
 * grid, and the designs applied to the whole batch. Child of
 * `ProductBasicInfoPOM`, scoped to its root.
 */
export class TextileBatchEditorPOM extends BasePOM {
  readonly garments: Locator
  /** Every garment line row (one model × colour, expanded into a size grid). */
  readonly garmentRows: Locator
  readonly addGarment: Locator
  readonly designs: Locator
  /** Every design row (one design at one placement). */
  readonly designRows: Locator
  readonly addDesign: Locator
  private readonly sizeQuantities: Locator

  constructor(page: Page, basicInfoRoot: Locator) {
    super(page)
    const IDS_TEXTILE = IDS.textile
    this.garments = basicInfoRoot.getByTestId(IDS_TEXTILE.garments)
    this.garmentRows = this.garments.getByTestId(IDS_TEXTILE.garmentRow)
    this.addGarment = this.garments.getByTestId(IDS_TEXTILE.addGarment)
    this.sizeQuantities = this.garments.getByTestId(IDS_TEXTILE.sizeQuantity)
    this.designs = basicInfoRoot.getByTestId(IDS_TEXTILE.designs)
    this.designRows = this.designs.getByTestId(IDS_TEXTILE.designRow)
    this.addDesign = this.designs.getByTestId(IDS_TEXTILE.addDesign)
  }

  /** The quantity box of one catalog variant — one cell of a row's size grid. */
  sizeQuantity(variantId: string): Locator {
    return this.withAttr(this.sizeQuantities, 'data-variant-id', variantId)
  }

  removeGarment(row: Locator): Locator {
    return row.getByTestId(IDS.textile.removeGarment)
  }

  /** Switches the row between the catalog cascade and free text. */
  freeTextToggle(row: Locator): Locator {
    return row.getByTestId(IDS.textile.freeTextToggle)
  }

  removeDesign(row: Locator): Locator {
    return row.getByTestId(IDS.textile.removeDesign)
  }
}
