/**
 * Textile batch editor — the basic-info form of the single TEXTILE_GARMENT
 * type, whose product is a **batch** rather than a single line.
 *
 * Two editors in one form, matching the two 1:n children of the batch:
 *
 * - **Garment lines** (`textile_garments`): one UI row per model × colour,
 *   expanded into a *size grid* — one quantity box per size the catalog carries
 *   for that model and colour. The shop thinks in size runs ("10×S 20×M 20×L"),
 *   so one row of boxes replaces what used to be one dialog per size. Each box
 *   with a quantity becomes one garment line; the size option's value *is* the
 *   variant id, so a phantom SKU is structurally impossible. A row can be
 *   switched to free text for garments the catalog doesn't carry (and for
 *   customer-supplied ones) — such a line is not stock-tracked, and the row
 *   says so.
 * - **Designs** (`textile_designs`): one row per design applied to the whole
 *   batch — an order file or typed-out text, plus placement, size and print
 *   method. Declared once ("logo, chest left, large") and valid for every line.
 *
 * Both drafts are local state, folded into the values handed to
 * `validateProduct` and to the textile arm of `ProductWriteInput`, which the
 * product write replaces wholesale.
 */

import { useContext, useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validateProduct } from '../../../lib/products/registry'
import { textileDesignToRow, textileGarmentToLine } from '../../../lib/products/schemas/textile'
import { useSaveProduct } from '../../../queries/productQueries'
import { textileService, type SizeOption } from '../../../services/textileService'
import { textileMasterDataService } from '../../../services/textileMasterDataService'
import type { ProductWriteInput, TextileDesignRow, TextileGarmentLineRow } from '../../../types/product'
import { useToast } from '../../Toast'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SectionHeader } from '../../ui/section-title'
import {
  TEXTILE_APPLICATION_SIZE_OPTIONS,
  TEXTILE_FONT_CLASS_OPTIONS,
  TEXTILE_GARMENT_TYPE_OPTIONS,
  TEXTILE_ORIGIN_OPTIONS,
  TEXTILE_PLACEMENT_OPTIONS,
} from '../../../lib/textileOptions'
import { FormActions } from './fields'
import { ProductViewContext } from './viewContext'
import type { FormValues, ProductFormProps } from './shared'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.basicInfo.textile

// --- Drafts -----------------------------------------------------------------

/**
 * One row of the garment editor. A `CATALOG` row is a model × colour whose
 * sizes are quantity boxes (`quantities`, keyed by `textile_variants.id`); a
 * `FREE_TEXT` row is a single described garment with one quantity.
 *
 * A box keeps its own size label beside the quantity, so a row describes every
 * line it will emit without the catalog having to be consulted again.
 */
type SizeBox = { size: string; quantity: string }

type GarmentRowDraft =
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

type DesignDraft = {
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

const emptyCatalogRow = (): GarmentRowDraft => ({
  key: nextKey(),
  mode: 'CATALOG',
  brandId: '',
  modelId: '',
  brand: '',
  model: '',
  color: '',
  quantities: {},
})

const emptyFreeTextRow = (): GarmentRowDraft => ({
  key: nextKey(),
  mode: 'FREE_TEXT',
  origin: 'SHOP_SUPPLIED',
  garment_type: '',
  brand: '',
  model: '',
  color: '',
  size: '',
  quantity: '',
})

const emptyDesign = (): DesignDraft => ({
  key: nextKey(),
  type: 'FILE',
  content: '',
  color: '',
  font_class: '',
  font_name: '',
  file_id: '',
  placement: '',
  size: '',
  print_method: '',
})

/**
 * Rebuild the editor's rows from the batch's stored lines. Catalog lines group
 * by brand/model/colour — one grid row per group, quantities keyed by variant —
 * and every free-text line is a row of its own. The full size run is fetched
 * per row (see {@link CatalogGarmentRow}) so sizes the order skipped show as
 * empty boxes; the stored quantities seed the rest.
 */
function garmentRowsFromLines(lines: readonly TextileGarmentLineRow[]): GarmentRowDraft[] {
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

function designsFromRows(rows: readonly TextileDesignRow[]): DesignDraft[] {
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
function flattenGarments(rows: readonly GarmentRowDraft[]): FormValues[] {
  const values: FormValues[] = []
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

function flattenDesigns(designs: readonly DesignDraft[]): FormValues[] {
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
function batchTotal(garments: readonly FormValues[]): number {
  return garments.reduce((sum, line) => {
    const parsed = Number.parseInt(String(line.quantity ?? ''), 10)
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
  }, 0)
}

// --- Garment rows -----------------------------------------------------------

/**
 * One catalog row: brand → model → colour from the catalog, then a quantity box
 * per size that colour is carried in. A stored row arrives with its model and
 * colour already resolved (see {@link useResolvePrefilledRows}), so the cascade
 * here only ever fetches the lists those selections need.
 */
function CatalogGarmentRow({
  row,
  shortVariantIds,
  onChange,
}: {
  row: GarmentRowDraft & { mode: 'CATALOG' }
  shortVariantIds: Set<string>
  onChange: (patch: Partial<GarmentRowDraft & { mode: 'CATALOG' }>) => void
}) {
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [colors, setColors] = useState<string[]>([])
  // The size run is stored under the model+colour it was fetched for, so a
  // changed selection reads as "no sizes yet" without having to be cleared.
  const [loadedSizes, setLoadedSizes] = useState<{ key: string; sizes: SizeOption[] }>({
    key: '',
    sizes: [],
  })
  const sizeRunKey = `${row.modelId}|${row.color}`
  const sizes = loadedSizes.key === sizeRunKey ? loadedSizes.sizes : []

  useEffect(() => {
    let alive = true
    textileMasterDataService
      .getBrandNames()
      .then(rows => { if (alive) setBrands(rows) })
      .catch(() => {})
    return () => { alive = false }
  }, [])


  useEffect(() => {
    if (!row.brandId) return
    let alive = true
    textileService
      .getModelsByBrandId(row.brandId)
      .then(rows => { if (alive) setModels(rows.map(model => ({ id: model.id, name: model.name }))) })
      .catch(() => {})
    return () => { alive = false }
  }, [row.brandId])

  useEffect(() => {
    if (!row.modelId) return
    let alive = true
    textileService
      .getVariantColorsByModel(row.modelId)
      .then(rows => { if (alive) setColors(rows.map(option => option.color)) })
      .catch(() => {})
    return () => { alive = false }
  }, [row.modelId])

  useEffect(() => {
    if (!row.modelId || !row.color) return
    let alive = true
    textileService
      .getVariantSizesByModelAndColor(row.modelId, row.color)
      .then(rows => { if (alive) setLoadedSizes({ key: `${row.modelId}|${row.color}`, sizes: rows }) })
      .catch(() => {})
    return () => { alive = false }
  }, [row.modelId, row.color])

  // Changing brand or model invalidates everything downstream, quantities
  // included — they are keyed by variants that belong to the old model.
  const handleBrandChange = (brandId: string) =>
    onChange({
      brandId,
      brand: brands.find(brand => brand.id === brandId)?.name ?? '',
      modelId: '',
      model: '',
      color: '',
      quantities: {},
    })
  const handleModelChange = (modelId: string) =>
    onChange({
      modelId,
      model: models.find(model => model.id === modelId)?.name ?? '',
      color: '',
      quantities: {},
    })
  const handleColorChange = (color: string) => onChange({ color, quantities: {} })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Select value={row.brandId || undefined} onValueChange={handleBrandChange}>
          <SelectTrigger size="sm" className="w-40"><SelectValue placeholder="Brand…" /></SelectTrigger>
          <SelectContent>
            {brands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={row.modelId || undefined} onValueChange={handleModelChange} disabled={!row.brandId}>
          <SelectTrigger size="sm" className="w-48"><SelectValue placeholder="Model…" /></SelectTrigger>
          <SelectContent>
            {models.map(model => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={row.color || undefined} onValueChange={handleColorChange} disabled={!row.modelId}>
          <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Colour…" /></SelectTrigger>
          <SelectContent>
            {colors.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {row.color !== '' && (
        sizes.length === 0 ? (
          <p className="text-xs text-muted-foreground">This colour is not carried in any size.</p>
        ) : (
          // The size run as one row of boxes: how the shop states a textile order.
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <label key={size.id} className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground">{size.size}</span>
                <Input
                  data-testid={IDS.sizeQuantity}
                  data-variant-id={size.id}
                  inputMode="numeric"
                  aria-label={`Quantity ${size.size}`}
                  className={cn('h-8 w-14 text-center', shortVariantIds.has(size.id) && 'border-destructive bg-destructive/10')}
                  value={row.quantities[size.id]?.quantity ?? ''}
                  onChange={event =>
                    onChange({
                      quantities: {
                        ...row.quantities,
                        [size.id]: { size: size.size, quantity: event.target.value },
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        )
      )}
    </div>
  )
}

/** One free-text row: a garment the catalog doesn't carry, or the customer's own. */
function FreeTextGarmentRow({
  row,
  onChange,
}: {
  row: GarmentRowDraft & { mode: 'FREE_TEXT' }
  onChange: (patch: Partial<GarmentRowDraft & { mode: 'FREE_TEXT' }>) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Select value={row.origin} onValueChange={origin => onChange({ origin })}>
          <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEXTILE_ORIGIN_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {row.origin === 'CUSTOMER_SUPPLIED' ? (
          <Select value={row.garment_type || undefined} onValueChange={garment_type => onChange({ garment_type })}>
            <SelectTrigger size="sm" className="w-40"><SelectValue placeholder="Garment…" /></SelectTrigger>
            <SelectContent>
              {TEXTILE_GARMENT_TYPE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <>
            <Input className="h-8 w-32" placeholder="Brand" value={row.brand} onChange={event => onChange({ brand: event.target.value })} />
            <Input className="h-8 w-36" placeholder="Model" value={row.model} onChange={event => onChange({ model: event.target.value })} />
          </>
        )}

        <Input className="h-8 w-28" placeholder="Colour" value={row.color} onChange={event => onChange({ color: event.target.value })} />
        {row.origin === 'SHOP_SUPPLIED' && (
          <Input className="h-8 w-20" placeholder="Size" value={row.size} onChange={event => onChange({ size: event.target.value })} />
        )}
        <Input
          className="h-8 w-16 text-center"
          inputMode="numeric"
          aria-label="Quantity"
          placeholder="Qty"
          value={row.quantity}
          onChange={event => onChange({ quantity: event.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Described by hand — this line is not stock-tracked: no deduction on release, no shortage check, no reorder demand.
      </p>
    </div>
  )
}

function GarmentsEditor({
  rows,
  shortVariantIds,
  error,
  total,
  onChange,
}: {
  rows: GarmentRowDraft[]
  shortVariantIds: Set<string>
  error?: string
  total: number
  onChange: (next: GarmentRowDraft[]) => void
}) {
  // View mode hides the row actions, as `FormActions` hides the footer.
  const readOnly = useContext(ProductViewContext)
  const patchRow = (key: string, patch: Partial<GarmentRowDraft>) =>
    onChange(rows.map(row => (row.key === key ? ({ ...row, ...patch } as GarmentRowDraft) : row)))

  return (
    <section data-testid={IDS.garments} className="flex flex-col gap-2">
      <SectionHeader title={total > 0 ? `Garments — ${total} pieces` : 'Garments'} />
      {rows.map(row => (
        <div key={row.key} data-testid={IDS.garmentRow} className="flex items-start gap-2 rounded-md border p-2">
          <div className="flex-1 min-w-0">
            {row.mode === 'CATALOG' ? (
              <CatalogGarmentRow
                row={row}
                shortVariantIds={shortVariantIds}
                onChange={patch => patchRow(row.key, patch)}
              />
            ) : (
              <FreeTextGarmentRow row={row} onChange={patch => patchRow(row.key, patch)} />
            )}
          </div>
          {!readOnly && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-testid={IDS.removeGarment}
                title="Remove this garment"
                aria-label="Remove this garment"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(rows.filter(other => other.key !== row.key))}
              >
                <Trash2 />
              </Button>
              <Button
                type="button"
                variant="link"
                size="xs"
                data-testid={IDS.freeTextToggle}
                className="h-auto p-0 text-xs"
                onClick={() =>
                  onChange(
                    rows.map(other =>
                      other.key !== row.key
                        ? other
                        : other.mode === 'CATALOG'
                          ? { ...emptyFreeTextRow(), key: other.key, brand: other.brand, model: other.model, color: other.color }
                          : { ...emptyCatalogRow(), key: other.key },
                    ),
                  )
                }
              >
                {row.mode === 'CATALOG' ? 'Free text' : 'Catalog'}
              </Button>
            </div>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!readOnly && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={IDS.addGarment}
            onClick={() => onChange([...rows, emptyCatalogRow()])}
          >
            + Add garment
          </Button>
        </div>
      )}
    </section>
  )
}

// --- Designs ----------------------------------------------------------------

/**
 * The batch's designs. A design is declared once and holds for every garment
 * line, so there is no per-line application: one row = one design at one
 * placement (which the table's UNIQUE (product_id, placement) enforces).
 */
function DesignsEditor({
  designs,
  orderFiles,
  error,
  onChange,
}: {
  designs: DesignDraft[]
  orderFiles: ProductFormProps['orderFiles']
  error?: string
  onChange: (next: DesignDraft[]) => void
}) {
  const readOnly = useContext(ProductViewContext)
  const patchDesign = (key: string, patch: Partial<DesignDraft>) =>
    onChange(designs.map(design => (design.key === key ? { ...design, ...patch } : design)))

  return (
    <section data-testid={IDS.designs} className="flex flex-col gap-2">
      <SectionHeader title="Designs" />
      {designs.length === 0 && (
        <p className="text-xs text-muted-foreground">No design applied yet.</p>
      )}
      {designs.map(design => (
        <div key={design.key} data-testid={IDS.designRow} className="flex items-start gap-2 rounded-md border p-2">
          <div className="flex flex-1 min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Select value={design.type} onValueChange={value => patchDesign(design.key, { type: value as DesignDraft['type'] })}>
                <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FILE">Artwork file</SelectItem>
                  <SelectItem value="TEXT">Text</SelectItem>
                </SelectContent>
              </Select>

              {design.type === 'FILE' ? (
                <Select value={design.file_id || undefined} onValueChange={file_id => patchDesign(design.key, { file_id })}>
                  <SelectTrigger size="sm" className="w-56"><SelectValue placeholder="Pick an order file…" /></SelectTrigger>
                  <SelectContent>
                    {orderFiles.map(file => <SelectItem key={file.id} value={file.id}>{file.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-8 w-56" placeholder="Text" value={design.content} onChange={event => patchDesign(design.key, { content: event.target.value })} />
              )}

              <Select value={design.placement || undefined} onValueChange={placement => patchDesign(design.key, { placement })}>
                <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Placement…" /></SelectTrigger>
                <SelectContent>
                  {TEXTILE_PLACEMENT_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={design.size || undefined} onValueChange={size => patchDesign(design.key, { size })}>
                <SelectTrigger size="sm" className="w-28"><SelectValue placeholder="Size…" /></SelectTrigger>
                <SelectContent>
                  {TEXTILE_APPLICATION_SIZE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-8 w-40"
                placeholder="Print method (optional)"
                value={design.print_method}
                onChange={event => patchDesign(design.key, { print_method: event.target.value })}
              />
            </div>

            {design.type === 'TEXT' && (
              <div className="flex flex-wrap gap-2">
                <Input className="h-8 w-28" placeholder="#FFFFFF" value={design.color} onChange={event => patchDesign(design.key, { color: event.target.value })} />
                <Select value={design.font_class || undefined} onValueChange={font_class => patchDesign(design.key, { font_class })}>
                  <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Font…" /></SelectTrigger>
                  <SelectContent>
                    {TEXTILE_FONT_CLASS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="h-8 w-40" placeholder="Font name (optional)" value={design.font_name} onChange={event => patchDesign(design.key, { font_name: event.target.value })} />
              </div>
            )}
          </div>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-testid={IDS.removeDesign}
              title="Remove this design"
              aria-label="Remove this design"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(designs.filter(other => other.key !== design.key))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!readOnly && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={IDS.addDesign}
            onClick={() => onChange([...designs, emptyDesign()])}
          >
            + Add design
          </Button>
          {orderFiles.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Link the artwork to the order first (Files tab).</p>
          )}
        </div>
      )}
    </section>
  )
}

// --- The batch form ---------------------------------------------------------

/**
 * Resolve each stored catalog row's model and brand from the variant its
 * quantities are keyed by — a `textile_garments` line references the variant,
 * not the model, so the grid's cascade has to be walked back up once before it
 * can show the full size run. Rows whose variant no longer resolves are
 * remembered as attempted, so a vanished catalog entry cannot start a refetch
 * loop; such a row simply stays on its brand picker.
 */
function useResolvePrefilledRows(
  rows: GarmentRowDraft[],
  setRows: (update: (previous: GarmentRowDraft[]) => GarmentRowDraft[]) => void,
): void {
  const attempted = useRef(new Set<string>())

  useEffect(() => {
    const pending = rows.filter(
      (row): row is GarmentRowDraft & { mode: 'CATALOG' } =>
        row.mode === 'CATALOG' &&
        row.modelId === '' &&
        Object.keys(row.quantities).length > 0 &&
        !attempted.current.has(row.key),
    )
    if (pending.length === 0) return
    for (const row of pending) attempted.current.add(row.key)

    let alive = true
    ;(async () => {
      const resolutions = await Promise.all(
        pending.map(async row => {
          const variantId = Object.keys(row.quantities)[0]
          const variant = await textileService.getVariantById(variantId)
          if (!variant) return null
          const model = await textileService.getModelById(variant.model_id)
          return {
            key: row.key,
            brandId: model?.brand_id ?? '',
            modelId: variant.model_id,
            color: variant.color,
          }
        }),
      )
      if (!alive) return
      setRows(previous =>
        previous.map(row => {
          const hit = resolutions.find(resolution => resolution?.key === row.key)
          return hit && row.mode === 'CATALOG' ? { ...row, ...hit } : row
        }),
      )
    })().catch(() => {})
    return () => { alive = false }
  }, [rows, setRows])
}

export function TextileBatchForm(props: ProductFormProps) {
  const saveProduct = useSaveProduct()
  const { showError } = useToast()

  const batch = props.product && 'garments' in props.product ? props.product : null
  const [rows, setRows] = useState<GarmentRowDraft[]>(() =>
    batch ? garmentRowsFromLines(batch.garments) : [emptyCatalogRow()],
  )
  const [designs, setDesigns] = useState<DesignDraft[]>(() =>
    batch ? designsFromRows(batch.designs) : [emptyDesign()],
  )
  useResolvePrefilledRows(rows, setRows)

  const garments = flattenGarments(rows)
  const designValues = flattenDesigns(designs)
  const errors = validateProduct(
    'TEXTILE_GARMENT',
    { garments, designs: designValues },
    props.orderIsQuote,
  )
  const shortVariantIds = new Set((props.shortages ?? []).map(shortage => shortage.targetId))

  const handleSubmit = () => {
    if (Object.keys(errors).length > 0) return
    const input: ProductWriteInput = {
      ...(props.product ? { id: props.product.id } : {}),
      order_id: props.orderId,
      department: props.department,
      type: 'TEXTILE_GARMENT',
      // The batch total is the sum of its lines, so the parent carries no quantity.
      quantity: null,
      notes: null,
      sort_order: props.sortOrder,
      garments: garments.map((line, index) => textileGarmentToLine(line, index)),
      designs: designValues.map(textileDesignToRow),
    }
    saveProduct.mutate(
      { input, fileIds: [], orderId: props.orderId },
      {
        onSuccess: ({ products, productId }) => props.onSaved(products, productId),
        onError: () => showError(props.product ? 'Batch could not be saved' : 'Batch could not be added'),
      },
    )
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        event.stopPropagation()
        handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <GarmentsEditor
        rows={rows}
        shortVariantIds={shortVariantIds}
        error={errors.garments}
        total={batchTotal(garments)}
        onChange={setRows}
      />
      <DesignsEditor
        designs={designs}
        orderFiles={props.orderFiles}
        error={errors.designs}
        onChange={setDesigns}
      />
      <FormActions
        canSubmit={Object.keys(errors).length === 0}
        submitting={saveProduct.isPending}
        editing={!!props.product}
        onCancel={props.onCancel}
      />
    </form>
  )
}
