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
  /** The Files field of every non-textile form. */
  readonly files: ProductFilesFieldPOM
  /** The textile batch editor, present only for a TEXTILE_GARMENT product. */
  readonly textile: TextileBatchEditorPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.edit = this.root.getByTestId(IDS.edit)
    this.fields = this.root.getByTestId(IDS.field)
    this.submit = this.root.getByTestId(IDS.submit)
    this.cancel = this.root.getByTestId(IDS.cancel)
    this.files = new ProductFilesFieldPOM(page, this.root)
    this.textile = new TextileBatchEditorPOM(page, this.root)
  }

  field(name: string): Locator {
    return this.withAttr(this.fields, 'data-field', name)
  }
}

/**
 * The shared file picker: the *Add artwork* drop zone, the order-files list,
 * and the button it folds into once its host holds a file. A host's own tab
 * (the textile editor's *Text*) is reached through that host's page object.
 * Scoped to whatever contains it, so each host passes its own root.
 */
export class FilePickerPOM extends BasePOM {
  readonly root: Locator
  /** The fold button; clicking it opens the picker again. */
  readonly expand: Locator
  readonly dropTab: Locator
  readonly filesTab: Locator
  /** Click to browse, or drop files on it. */
  readonly dropZone: Locator
  /** Every order file listed on the files tab; each carries `data-file-id`. */
  readonly files: Locator

  constructor(page: Page, host: Locator) {
    super(page)
    const PICKER = TEST_IDS.filePicker
    this.root = host.getByTestId(PICKER.root)
    this.expand = host.getByTestId(PICKER.expand)
    this.dropTab = this.root.getByTestId(PICKER.dropTab)
    this.filesTab = this.root.getByTestId(PICKER.filesTab)
    this.dropZone = this.root.getByTestId(PICKER.dropZone)
    this.files = this.root.getByTestId(PICKER.file)
  }

  /** One order file on the files tab; clicking it hands the file to the host. */
  file(fileId: string): Locator {
    return this.withAttr(this.files, 'data-file-id', fileId)
  }
}

/**
 * The Files field of a non-textile product form: a chip per attached file over
 * the shared picker. Child of `ProductBasicInfoPOM`, scoped to its root.
 */
export class ProductFilesFieldPOM extends BasePOM {
  readonly root: Locator
  /** Every attached-file chip; each carries `data-file-id`. */
  readonly chips: Locator
  /** The picker under the chips; absent in read-only mode. */
  readonly picker: FilePickerPOM

  constructor(page: Page, basicInfoRoot: Locator) {
    super(page)
    this.root = basicInfoRoot.getByTestId(IDS.files.root)
    this.chips = this.root.getByTestId(IDS.files.chip)
    this.picker = new FilePickerPOM(page, this.root)
  }

  chip(fileId: string): Locator {
    return this.withAttr(this.chips, 'data-file-id', fileId)
  }

  /** Detaches the chip's file from the product. */
  chipRemove(fileId: string): Locator {
    return this.chip(fileId).getByTestId(IDS.files.chipRemove)
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
  /** The design picker: the shared drop zone and order-files tabs, plus the editor's own *Text* tab. */
  readonly picker: FilePickerPOM
  /** The picker's own *Text* tab. */
  readonly pickerTextTab: Locator
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
    this.picker = new FilePickerPOM(page, this.designs)
    this.addDesign = this.picker.root.getByTestId(IDS_TEXTILE.addDesign)
    this.pickerTextTab = this.picker.root.getByTestId(IDS_TEXTILE.pickerTextTab)
    this.pickerText = this.picker.root.getByTestId(IDS_TEXTILE.pickerText)
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
