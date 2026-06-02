import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDateDe } from '../formatDate'
import { orderService } from '../../services/orderService'
import { subOrderService } from '../../services/subOrderService'
import { subOrderProductService } from '../../services/subOrderProductService'
import { textileService } from '../../services/textileService'
import type { DeliveryChoice, OrderPdfRow, Priority, SubOrderRow } from '../../types/database'

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } }

function asDetailRecord(detail: unknown): Record<string, unknown> {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return detail as Record<string, unknown>
  }
  return {}
}

function fieldToLabel(key: string): string {
  switch (key) {
    case 'typ':
      return 'Type'
    case 'stueckzahl':
      return 'Quantity'
    case 'material':
    case 'material_freitext':
      return 'Material'
    case 'material_sonstige':
      return 'Material (other)'
    case 'format_breite':
      return 'Width (mm)'
    case 'format_hoehe':
      return 'Height (mm)'
    case 'ecken_runden':
      return 'Round corners'
    case 'selbstklebend':
      return 'Self-adhesive'
    case 'motiv':
      return 'Motif / Content'
    case 'herkunft':
      return 'Origin'
    case 'besonderheiten':
      return 'Notes'
    case 'beschreibung':
      return 'Description'
    default:
      return key
  }
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

function buildFileName(
  customerName: string,
  deadline: string | null | undefined,
  createdAt: string,
  department: string,
  orderNumber: string,
): string {
  const normalizedCustomer = normalizeFileNameSegment(customerName)
  const yearMonthStr = yearMonth(deadline || createdAt)
  const departmentStr = department.toLowerCase()
  const orderNumberStr = normalizeFileNameSegment(orderNumber) || orderNumber.toLowerCase().replace(/\s+/g, '_')
  return `${normalizedCustomer}_${yearMonthStr}_${departmentStr}_${orderNumberStr}.pdf`
}

function formatDelivery(deliveryType: DeliveryChoice | null | undefined): string {
  if (deliveryType === 'PICKUP') return 'Pickup'
  if (deliveryType === 'SHIPPING') return 'Shipping'
  return '—'
}

function formatPriority(priorityType: Priority): string {
  if (priorityType === 'HIGH') return '⚡ HIGH'
  return 'Normal'
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

function productDetailKeys(products: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  const skip = new Set(['typ', 'hat_produkte', 'datei_id'])

  for (const row of products) {
    const detail = asDetailRecord(row.detail)
    for (const key of Object.keys(detail)) {
      if (skip.has(key)) continue
      if (!seen.has(key)) {
        seen.add(key)
        order.push(key)
      }
    }
  }
  return order
}

function cellValueForKey(row: Record<string, unknown>, key: string): string {
  const detail = asDetailRecord(row.detail)
  const fieldValue = detail[key]
  if (isEmpty(fieldValue)) return ''
  if (key === 'ecken_runden' || key === 'selbstklebend') {
    if (fieldValue === true) return 'Yes'
    if (fieldValue === false) return 'No'
  }
  return valueAsString(fieldValue)
}

export async function generateAndDownloadPdf(subOrderId: string, orderId: string): Promise<boolean> {
  try {
    const [order, subOrderResult, rawProducts, textilePositions] = await Promise.all([
      orderService.getOrderById(orderId),
      subOrderService.getSubOrderById(subOrderId),
      subOrderProductService.getProductsBySubOrderId(subOrderId),
      textileService.getPositionsWithVariants(subOrderId),
    ])

    if (!order || !subOrderResult) return false

    const subOrder = subOrderResult as SubOrderRow

    const products = rawProducts as unknown as Record<string, unknown>[]

    const customer = (order as OrderPdfRow).customers
    const customerDisplayName = customer?.name?.trim() ? customer.name.trim() : 'Unknown'

    const fileName = buildFileName(
      customerDisplayName,
      order.deadline,
      order.created_at,
      subOrder.department,
      order.order_number,
    )

    const marginLeft = 15
    const marginRight = 15
    const marginTop = 15

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    let cursorY = marginTop

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(0)
    cursorY = addText(doc, `ORDER ${order.order_number}`, marginLeft, cursorY, 8)
    doc.setFont('helvetica', 'normal')

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

    const rightColumnX = 120
    doc.setFontSize(10)
    doc.setTextColor(0)
    rightColumnY = addText(doc, `Deadline    ${formatDateDe(order.deadline)}`, rightColumnX, rightColumnY, 5)
    rightColumnY = addText(doc, `Delivery    ${formatDelivery(order.delivery)}`, rightColumnX, rightColumnY, 5)
    rightColumnY = addText(doc, `Priority    ${formatPriority(order.priority)}`, rightColumnX, rightColumnY, 5)
    rightColumnY = addText(doc, `Department    ${subOrder.department}`, rightColumnX, rightColumnY, 5)
    rightColumnY = addText(doc, `Created    ${formatDateDe(order.created_at)}`, rightColumnX, rightColumnY, 5)

    cursorY = Math.max(leftColumnY, rightColumnY) + 8

    doc.setDrawColor(60)
    doc.line(marginLeft, cursorY, 210 - marginRight, cursorY)
    cursorY += 5

    if (products.length > 0 && subOrder.department !== 'TEXTILE') {
      cursorY = checkNewPage(doc, cursorY, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      cursorY = addText(doc, 'Products', marginLeft, cursorY, 6)
      doc.setFont('helvetica', 'normal')

      const detailKeys = productDetailKeys(products)
      const header = ['#', 'Type', ...detailKeys.map(fieldToLabel)]
      const rows = products.map((product, idx) => {
        const detail = asDetailRecord(product.detail)
        const typeValue = String(product.typ ?? detail.typ ?? '—')
        return [String(idx + 1), typeValue, ...detailKeys.map(key => cellValueForKey(product, key))]
      })

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginLeft, right: marginRight },
        head: [header],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })
      cursorY = ((doc as PdfDoc).lastAutoTable?.finalY ?? cursorY) + 8
    }

    if (subOrder.department === 'TEXTILE' && textilePositions.length > 0) {
      cursorY = checkNewPage(doc, cursorY, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      cursorY = addText(doc, 'Positions', marginLeft, cursorY, 6)
      doc.setFont('helvetica', 'normal')

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginLeft, right: marginRight },
        head: [['Product', 'Colour', 'Size', 'Quantity', 'Origin', 'Note']],
        body: textilePositions.map(position => {
          const positionRecord = position as Record<string, unknown>
          const variantEmbed = positionRecord.textile_variants as {
            textile_products: { name: string | null } | null
          } | null
          const productName =
            variantEmbed?.textile_products?.name ?? String(positionRecord.model ?? positionRecord.variant_id ?? '—')
          return [
            productName,
            String(position.color ?? '—'),
            String(position.size ?? '—'),
            String(position.quantity ?? '—'),
            String(position.origin ?? '—'),
            String(positionRecord.note ?? ''),
          ]
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })
      cursorY = ((doc as PdfDoc).lastAutoTable?.finalY ?? cursorY) + 8
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Page ${i} / ${totalPages}`, 210 - marginRight, 290, { align: 'right' })
    }

    doc.save(fileName)
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}
