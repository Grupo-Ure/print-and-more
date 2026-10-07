/**
 * The textile batch editor's drafts — the rows the editor holds while a batch
 * is being described — and the pure conversions on either side of them: stored
 * garment lines and designs → drafts when a batch is opened, drafts → the flat
 * values `validateProduct` checks when it is saved.
 *
 * The other half of the mapping, flat values → child rows, is the schema's
 * (`textileGarmentToLine`, `textileDesignToRow` in `schemas/textile.ts`). No
 * component imports: everything here is data in, data out.
 */

import type { TextileDesignRow, TextileGarmentLineRow } from '@/types/product'

/** One flat garment line or design, as the textile schema reads it. */
type FlatValues = Record<string, unknown>

/**
 * One row of the garment editor. A `CATALOG` row is a model × colour whose
 * sizes are quantity boxes (`quantities`, keyed by `textile_variants.id`); a
 * `FREE_TEXT` row is a single described garment with one quantity.
 *
 * A box keeps its own size label beside the quantity, so a row describes every
 * line it will emit without the catalog having to be consulted again.
 */
type SizeBox = { size: string; quantity: string }

export type GarmentRowDraft =
  | {
      key: string
      mode: 'CATALOG'
      brandId: string
      modelId: string
      /** Labels captured from the cascade; every emitted line carries them. */
      brand: string
      model: string
      color: string
      quantities: Record<string, SizeBox>
    }
  | {
      key: string
      mode: 'FREE_TEXT'
      origin: string
      garment_type: string
      brand: string
      model: string
      color: string
      size: string
      quantity: string
    }

export type DesignDraft = {
  key: string
  type: 'TEXT' | 'FILE'
  content: string
  color: string
  font_class: string
  font_name: string
  file_id: string
  placement: string
  size: string
  print_method: string
}

const nextKey = (): string => crypto.randomUUID()

export function emptyCatalogRow(): GarmentRowDraft {
  return {
    key: nextKey(),
    mode: 'CATALOG',
    brandId: '',
    modelId: '',
    brand: '',
    model: '',
    color: '',
    quantities: {},
  }
}

export function emptyFreeTextRow(): GarmentRowDraft {
  return {
    key: nextKey(),
    mode: 'FREE_TEXT',
    origin: 'SHOP_SUPPLIED',
    garment_type: '',
    brand: '',
    model: '',
    color: '',
    size: '',
    quantity: '',
  }
}

export function emptyDesign(type: DesignDraft['type']): DesignDraft {
  return {
    key: nextKey(),
    type,
    content: '',
    color: '',
    font_class: '',
    font_name: '',
    file_id: '',
    placement: '',
    size: '',
    print_method: '',
  }
}

/**
 * Rebuild the editor's rows from the batch's stored lines. Catalog lines group
 * by brand/model/colour — one grid row per group, quantities keyed by variant —
 * and every free-text line is a row of its own. The full size run is fetched
 * per row by the editor, so sizes the order skipped show as empty boxes; the
 * stored quantities seed the rest.
 */
export function garmentRowsFromLines(lines: readonly TextileGarmentLineRow[]): GarmentRowDraft[] {
  const rows: GarmentRowDraft[] = []
  const catalogByGroup = new Map<string, GarmentRowDraft & { mode: 'CATALOG' }>()

  for (const line of lines) {
    if (line.variant_id) {
      const groupKey = `${line.brand ?? ''}|${line.model ?? ''}|${line.color ?? ''}`
      let row = catalogByGroup.get(groupKey)
      if (!row) {
        row = {
          key: nextKey(),
          mode: 'CATALOG',
          // Resolved from the first variant by the row itself.
          brandId: '',
          modelId: '',
          brand: line.brand ?? '',
          model: line.model ?? '',
          color: line.color ?? '',
          quantities: {},
        }
        catalogByGroup.set(groupKey, row)
        rows.push(row)
      }
      row.quantities[line.variant_id] = { size: line.size ?? '', quantity: String(line.quantity) }
      continue
    }
    rows.push({
      key: nextKey(),
      mode: 'FREE_TEXT',
      origin: line.origin ?? 'SHOP_SUPPLIED',
      garment_type: line.garment_type ?? '',
      brand: line.brand ?? '',
      model: line.model ?? '',
      color: line.color ?? '',
      size: line.size ?? '',
      quantity: String(line.quantity),
    })
  }

  return rows.length > 0 ? rows : [emptyCatalogRow()]
}

export function designsFromRows(rows: readonly TextileDesignRow[]): DesignDraft[] {
  return rows.map(row => ({
    key: nextKey(),
    type: row.type,
    content: row.content ?? '',
    color: row.color ?? '',
    font_class: row.font_class ?? '',
    font_name: row.font_name ?? '',
    file_id: row.file_id ?? '',
    placement: row.placement,
    size: row.size,
    print_method: row.print_method ?? '',
  }))
}

/**
 * Flatten the editor's rows into the flat garment values the schema validates
 * and maps. A catalog row contributes one line per size box that holds a
 * quantity — the boxes left empty are sizes the order doesn't want. Each line
 * stores its size label next to the variant reference, so a production sheet
 * reads without a catalog lookup.
 */
export function flattenGarments(rows: readonly GarmentRowDraft[]): FlatValues[] {
  const values: FlatValues[] = []
  for (const row of rows) {
    if (row.mode === 'FREE_TEXT') {
      values.push({
        origin: row.origin,
        variant_id: '',
        garment_type: row.garment_type,
        brand: row.brand,
        model: row.model,
        color: row.color,
        size: row.size,
        quantity: row.quantity,
      })
      continue
    }
    for (const [variantId, box] of Object.entries(row.quantities)) {
      if (box.quantity.trim() === '') continue
      values.push({
        origin: 'SHOP_SUPPLIED',
        variant_id: variantId,
        garment_type: '',
        brand: row.brand,
        model: row.model,
        color: row.color,
        size: box.size,
        quantity: box.quantity,
      })
    }
  }
  return values
}

export function flattenDesigns(designs: readonly DesignDraft[]): FlatValues[] {
  return designs.map(design => ({
    type: design.type,
    content: design.type === 'TEXT' ? design.content : '',
    color: design.type === 'TEXT' ? design.color : '',
    font_class: design.type === 'TEXT' ? design.font_class : '',
    font_name: design.type === 'TEXT' ? design.font_name : '',
    file_id: design.type === 'FILE' ? design.file_id : '',
    placement: design.placement,
    size: design.size,
    print_method: design.print_method,
  }))
}

/** Pieces in the batch — the sum of every line, shown beside the garment header. */
export function batchTotal(garments: readonly FlatValues[]): number {
  return garments.reduce((sum, line) => {
    const parsed = Number.parseInt(String(line.quantity ?? ''), 10)
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
  }, 0)
}
