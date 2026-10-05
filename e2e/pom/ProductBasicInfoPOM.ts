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
 * The textile product's basic-info form: the batch's garment lines, each
 * picked one guided step at a time (brand → model → colour) and expanded into
 * a size grid, and the designs applied to the whole batch, which come in
 * through the picker above the rows. Child of `ProductBasicInfoPOM`, scoped
 * to its root.
 */
export class TextileBatchEditorPOM extends BasePOM {
  readonly garments: Locator
  /** Every garment line row (one model × colour, expanded into a size grid). */
  readonly garmentRows: Locator
  readonly addGarment: Locator
  readonly designs: Locator
  /** Every design row (one design at one placement); carries `data-design-type`. */
  readonly designRows: Locator
  /** The text tab's add button. */
  readonly addDesign: Locator
  /** The design picker: a drop zone tab, an order-files tab and a text tab. Folded into `pickerExpand` once a design exists. */
  readonly picker: Locator
  /** The *Add another design* button; clicking it opens the picker again. */
  readonly pickerExpand: Locator
  readonly pickerDropTab: Locator
  readonly pickerFilesTab: Locator
  readonly pickerTextTab: Locator
  /** Click to browse, or drop files on it. */
  readonly pickerDropZone: Locator
  /** Every order file listed on the files tab; each carries `data-file-id`. */
  readonly pickerFiles: Locator
  /** The text tab's input. */
  readonly pickerText: Locator
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
    this.picker = this.designs.getByTestId(IDS_TEXTILE.picker)
    this.pickerExpand = this.designs.getByTestId(IDS_TEXTILE.pickerExpand)
    this.addDesign = this.picker.getByTestId(IDS_TEXTILE.addDesign)
    this.pickerDropTab = this.picker.getByTestId(IDS_TEXTILE.pickerDropTab)
    this.pickerFilesTab = this.picker.getByTestId(IDS_TEXTILE.pickerFilesTab)
    this.pickerTextTab = this.picker.getByTestId(IDS_TEXTILE.pickerTextTab)
    this.pickerDropZone = this.picker.getByTestId(IDS_TEXTILE.pickerDropZone)
    this.pickerFiles = this.picker.getByTestId(IDS_TEXTILE.pickerFile)
    this.pickerText = this.picker.getByTestId(IDS_TEXTILE.pickerText)
  }

  /** One order file on the picker's files tab; clicking it applies the file as a design. */
  pickerFile(fileId: string): Locator {
    return this.withAttr(this.pickerFiles, 'data-file-id', fileId)
  }

  /** One option of a guided step inside a garment or design row (`step`: brand, model, color, placement, size). */
  stepOption(row: Locator, step: string, value: string): Locator {
    return this.withAttr(this.withAttr(row.getByTestId(IDS.textile.stepOption), 'data-step', step), 'data-value', value)
  }

  /** The pick a row's trail shows for a step; clicking it reopens the step. */
  stepPick(row: Locator, step: string): Locator {
    return this.withAttr(row.getByTestId(IDS.textile.stepPick), 'data-step', step)
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
