/**
 * The PDF production sheet — one sheet per **product**, printed from the
 * product header in either view.
 *
 * Under the job model the sheet belonged to a job and tabulated the products it
 * held, so the spec was a wide table with one column per field any of them used.
 * A product is the unit of work now: the sheet describes exactly one, so its
 * spec reads as a label/value list of that type's own fields, and the
 * header states the product's *effective* deadline, delivery and priority — what
 * the floor must actually work to — rather than the order's raw values.
 *
 * Textile is the exception its batch model makes it: instead of one spec it
 * prints the batch's garment lines and the designs applied to them.
 *
 * Dates stay German (`formatDateDe`) — the sheet is read on the shop floor.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateDe } from '../formatDate'
import { orderService } from '../../services/orderService'
import { fileService } from '../../services/fileService'
import { productService } from '../../services/productService'
import { stampService } from '../../services/stampService'
import { PRODUCT_TYPE_LABELS } from '../productTypeLabels'
import { departmentLabel } from '../departmentLabels'
import {
  TEXTILE_APPLICATION_SIZE_OPTIONS,
  TEXTILE_GARMENT_TYPE_OPTIONS,
  TEXTILE_PLACEMENT_OPTIONS,
  textileOptionLabel,
} from '../textileOptions'
import { resolveEffectiveProduct } from '../productShared'
import type { DeliveryChoice, OrderDetailRow, Priority } from '../../types/database'
import type { LoadedProduct, TextileDesignRow, TextileGarmentLineRow } from '../../types/product'

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } }

/** Spec columns that name a row in another table — printed as the name, not the id. */
const MODEL_REFERENCE_KEYS = ['model_id', 'pad_variant_id'] as const

/**
 * Spec columns whose humanized name would read wrong. Everything else is
 * humanized from the column name, which the forms' own labels already match
 * (`drill_hole_position` → "Drill hole position").
 */
const SPEC_LABELS: Record<string, string> = {
  width: 'Width (mm)',
  height: 'Height (mm)',
  drill_hole_diameter: 'Drill hole diameter (mm)',
  color: 'Colour',
  color_mode: 'Colour mode',
  color_other: 'Colour (other)',
  binding_color: 'Binding colour',
  multiloft_color: 'Multiloft core',
  material_free_text: 'Material',
  cc_material: 'CC material',
  material_variant: '3551 variant',
  self_adhesive: 'Self-adhesive',
  model_id: 'Model',
  pad_variant_id: 'Pad',
  pad_article_number: 'Article number',
  offset_weight: 'Weight',
  offset_finish: 'Finish',
  rollup_system: 'System',
  rollup_width: 'Width',
  area_sides: 'Sides',
  area_front: 'Front',
  area_rear: 'Rear',
}

/** `drill_hole_position` → "Drill hole position"; `(other)` suffixes read as the forms write them. */
function specLabel(key: string): string {
  const known = SPEC_LABELS[key]
  if (known) return known
  if (key.endsWith('_other')) return `${specLabel(key.slice(0, -'_other'.length))} (other)`
  const words = key.split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function valueAsString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeFileNameSegment(input: string): string {
  let result = input.trim()
  const umlautReplacements = [
    ['ä', 'ae'],
    ['ö', 'oe'],
    ['ü', 'ue'],
    ['ß', 'ss'],
    ['Ä', 'ae'],
    ['Ö', 'oe'],
    ['Ü', 'ue'],
  ] as const
  for (const [from, to] of umlautReplacements) {
    result = result.split(from).join(to)
  }
  result = result.toLowerCase()
  result = result.replace(/\s+/g, '_')
  result = result.replace(/[^a-z0-9_-]/g, '')
  return result || 'kunde'
}

function yearMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return '0000-00'
  const match = isoDate.match(/^(\d{4})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}`
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '0000-00'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * The product number already carries the order number, the department and the
 * per-department counter, so it identifies the sheet on its own.
 */
function buildFileName({
  customerName,
  deadline,
  createdAt,
  productNumber,
}: {
  customerName: string
  deadline: string | null
  createdAt: string
  productNumber: string
}): string {
  const customerSegment = normalizeFileNameSegment(customerName)
  const productSegment =
    normalizeFileNameSegment(productNumber) || productNumber.toLowerCase().replace(/\s+/g, '_')
  return `${customerSegment}_${yearMonth(deadline ?? createdAt)}_${productSegment}.pdf`
}

function formatDelivery(delivery: DeliveryChoice | null | undefined): string {
  if (delivery === 'PICKUP') return 'Pickup'
  if (delivery === 'SHIPPING') return 'Shipping'
  return '—'
}

/**
 * The effective priority always resolves, but the column it resolves from is
 * nullable. Plain words, no symbol: the sheet prints in Helvetica's WinAnsi
 * encoding, which has no glyph for a lightning bolt.
 */
function formatPriority(priority: Priority | null): string {
  return priority === 'HIGH' ? 'HIGH' : 'Normal'
}

function addText(
  doc: jsPDF,
  text: string,
  xPos: number,
  yPos: number,
  lineHeightMm: number,
  opts?: { align?: 'left' | 'center' | 'right' | 'justify'; maxWidth?: number },
): number {
  doc.text(text, xPos, yPos, opts)
  return yPos + lineHeightMm
}

function checkNewPage(doc: jsPDF, cursorY: number, required = 20): number {
  if (cursorY + required > 277) {
    doc.addPage()
    return 15
  }
  return cursorY
}

/**
 * The spec rows of a single-child product: its quantity, then every set column
 * of its typed child row, with the model references already resolved to names.
 * Columns the type leaves empty are left out — a sheet states what was ordered,
 * not which fields the table has.
 */
function specRows(product: LoadedProduct, modelNamesById: Map<string, string>): string[][] {
  const rows: string[][] = []
  if (product.quantity != null) rows.push(['Quantity', String(product.quantity)])
  if (!('child' in product)) return rows

  for (const [key, value] of Object.entries(product.child as Record<string, unknown>)) {
    if (key === 'product_id' || isEmpty(value)) continue
    const resolved = MODEL_REFERENCE_KEYS.includes(key as (typeof MODEL_REFERENCE_KEYS)[number])
      ? modelNamesById.get(String(value)) ?? String(value)
      : valueAsString(value)
    rows.push([specLabel(key), resolved])
  }
  return rows
}

/** Every `stamp_models` id a product's spec points at (the model itself and its pad). */
function modelReferenceIds(product: LoadedProduct): string[] {
  if (!('child' in product)) return []
  const child = product.child as Record<string, unknown>
  return MODEL_REFERENCE_KEYS.map(key => child[key]).filter(
    (value): value is string => typeof value === 'string' && value !== '',
  )
}

/** A garment line as the floor reads it: brand, model and colour are stored on the line itself. */
function garmentRow(line: TextileGarmentLineRow): string[] {
  return [
    [line.brand, line.model].filter(Boolean).join(' ') || '—',
    textileOptionLabel(TEXTILE_GARMENT_TYPE_OPTIONS, line.garment_type),
    line.color ?? '—',
    line.size ?? '—',
    // Short forms: the "Supplied by" header already says what they answer.
    line.origin === 'CUSTOMER_SUPPLIED' ? 'Customer' : 'Shop',
    String(line.quantity),
  ]
}

/** A design row: the file's design or the typed text, and how it is applied. */
function designRow(design: TextileDesignRow, fileNamesById: Map<string, string>): string[] {
  const what =
    design.type === 'TEXT'
      ? `“${design.content ?? ''}”${design.font_name ? ` · ${design.font_name}` : ''}`
      : (design.file_id && fileNamesById.get(design.file_id)) || 'File'
  return [
    what,
    textileOptionLabel(TEXTILE_PLACEMENT_OPTIONS, design.placement),
    textileOptionLabel(TEXTILE_APPLICATION_SIZE_OPTIONS, design.size),
    design.print_method ?? '—',
    design.color ?? '—',
  ]
}

const TABLE_STYLES = {
  styles: { fontSize: 8, cellPadding: 2 },
  headStyles: { fillColor: [60, 60, 60] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] },
}

/** Everything the sheet prints, already resolved — the renderer reads nothing else. */
type ProductionSheetData = {
  order: OrderDetailRow
  product: LoadedProduct
  /** `stamp_models.id` → its name, for the spec's model references. */
  modelNamesById: Map<string, string>
  /** `files.id` → its display name, for a textile batch's FILE designs. */
  fileNamesById: Map<string, string>
}

/**
 * Lay the sheet out and return the document with the file name it should be
 * saved under. Pure: every lookup it needs is already in
 * {@link ProductionSheetData}.
 */
function renderProductionSheet({
  order,
  product,
  modelNamesById,
  fileNamesById,
}: ProductionSheetData): { doc: jsPDF; fileName: string } {
  const effective = resolveEffectiveProduct(product, order)
  const customer = order.customers
  const customerDisplayName = customer?.name?.trim() ? customer.name.trim() : 'Unknown'

  const fileName = buildFileName({
    customerName: customerDisplayName,
    deadline: effective.deadline,
    createdAt: order.created_at,
    productNumber: product.product_number,
  })

  const marginLeft = 15
  const marginRight = 15
  const marginTop = 15
  const rightColumnX = 120

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let cursorY = marginTop

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(0)
  cursorY = addText(doc, product.product_number, marginLeft, cursorY, 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(80)
  cursorY = addText(
    doc,
    `${departmentLabel(product.department)} · ${PRODUCT_TYPE_LABELS[product.type] ?? product.type}`,
    marginLeft,
    cursorY,
    6,
  )
  doc.setTextColor(0)

  doc.setDrawColor(60)
  doc.line(marginLeft, cursorY, 210 - marginRight, cursorY)
  cursorY += 5

  let leftColumnY = cursorY
  let rightColumnY = cursorY

  doc.setFontSize(8)
  doc.setTextColor(120)
  leftColumnY = addText(doc, 'Customer', marginLeft, leftColumnY, 4)
  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  leftColumnY = addText(doc, customerDisplayName, marginLeft, leftColumnY, 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  if (customer?.street || customer?.house_number) {
    const streetLine = [customer.street, customer.house_number].filter(Boolean).join(' ')
    leftColumnY = addText(doc, streetLine, marginLeft, leftColumnY, 5)
  }
  if (customer?.postal_code || customer?.city) {
    const cityLine = [customer.postal_code, customer.city].filter(Boolean).join(' ')
    if (cityLine) leftColumnY = addText(doc, cityLine, marginLeft, leftColumnY, 5)
  }
  if (customer?.email) leftColumnY = addText(doc, customer.email, marginLeft, leftColumnY, 5)
  if (customer?.phone) leftColumnY = addText(doc, customer.phone, marginLeft, leftColumnY, 5)

  // The product's effective values: its own override, else the order's.
  doc.setFontSize(10)
  doc.setTextColor(0)
  rightColumnY = addText(doc, `Deadline    ${formatDateDe(effective.deadline)}`, rightColumnX, rightColumnY, 5)
  rightColumnY = addText(doc, `Delivery    ${formatDelivery(effective.delivery)}`, rightColumnX, rightColumnY, 5)
  rightColumnY = addText(doc, `Priority    ${formatPriority(effective.priority)}`, rightColumnX, rightColumnY, 5)
  rightColumnY = addText(doc, `Order    ${order.order_number}`, rightColumnX, rightColumnY, 5)
  rightColumnY = addText(doc, `Created    ${formatDateDe(order.created_at)}`, rightColumnX, rightColumnY, 5)

  cursorY = Math.max(leftColumnY, rightColumnY) + 8

  doc.setDrawColor(60)
  doc.line(marginLeft, cursorY, 210 - marginRight, cursorY)
  cursorY += 5

  const sectionHeading = (heading: string, trailing?: string): void => {
    cursorY = checkNewPage(doc, cursorY, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    addText(doc, heading, marginLeft, cursorY, 0)
    if (trailing) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(trailing, 210 - marginRight, cursorY, { align: 'right' })
      doc.setTextColor(0)
    }
    cursorY += 6
    doc.setFont('helvetica', 'normal')
  }

  const addTable = (head: string[], body: string[][]): void => {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginLeft, right: marginRight },
      head: [head],
      body,
      ...TABLE_STYLES,
    })
    cursorY = ((doc as PdfDoc).lastAutoTable?.finalY ?? cursorY) + 8
  }

  if ('garments' in product) {
    const pieces = product.garments.reduce((sum, line) => sum + line.quantity, 0)
    sectionHeading('Garments', `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`)
    if (product.garments.length > 0) {
      addTable(
        ['Model', 'Garment', 'Colour', 'Size', 'Supplied by', 'Qty'],
        product.garments.map(garmentRow),
      )
    } else {
      cursorY = addText(doc, 'No garment lines.', marginLeft, cursorY, 8)
    }

    sectionHeading('Designs')
    if (product.designs.length > 0) {
      addTable(
        ['Design', 'Placement', 'Size', 'Print method', 'Colour'],
        product.designs.map(design => designRow(design, fileNamesById)),
      )
    } else {
      cursorY = addText(doc, 'No designs.', marginLeft, cursorY, 8)
    }
  } else {
    const rows = specRows(product, modelNamesById)
    if (rows.length > 0) {
      sectionHeading('Specification')
      addTable(['Field', 'Value'], rows)
    }
  }

  if (product.notes?.trim()) {
    sectionHeading('Notes')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(product.notes.trim(), 210 - marginLeft - marginRight)
    for (const line of lines) {
      cursorY = checkNewPage(doc, cursorY, 10)
      cursorY = addText(doc, line, marginLeft, cursorY, 5)
    }
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${page} / ${totalPages}`, 210 - marginRight, 290, { align: 'right' })
  }

  return { doc, fileName }
}

/**
 * Load one product's sheet data and download it. Returns `false` on any failure
 * (missing rows included) so the caller can show one toast; the cause goes to
 * the console.
 */
export async function generateAndDownloadProductionSheet(
  productId: string,
  orderId: string,
): Promise<boolean> {
  try {
    const [order, product] = await Promise.all([
      orderService.getOrderById(orderId),
      productService.getLoadedById(productId),
    ])
    if (!order || !product) return false

    // Only a stamp spec references a model, and only a textile batch names a
    // file, so most products skip both round trips.
    const referencedModelIds = modelReferenceIds(product)
    const models =
      referencedModelIds.length > 0
        ? await stampService.getStampModelStocksByIds(referencedModelIds)
        : []
    const designFiles =
      'designs' in product && product.designs.some(design => design.type === 'FILE')
        ? await fileService.getFilesByOrderId(order.id)
        : []

    const { doc, fileName } = renderProductionSheet({
      order,
      product,
      modelNamesById: new Map(models.map(model => [model.id, model.name])),
      fileNamesById: new Map(designFiles.map(file => [file.id, file.display_name])),
    })
    doc.save(fileName)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}
