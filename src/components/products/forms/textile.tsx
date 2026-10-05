/**
 * Textile batch editor — the basic-info form of the single TEXTILE_GARMENT
 * type, whose product is a **batch** rather than a single line.
 *
 * Two editors in one form, matching the two 1:n children of the batch:
 *
 * - **Garment lines** (`textile_garments`): one UI row per model × colour,
 *   picked one step at a time — a brand list, then that brand's models, then
 *   the model's colours — and expanded into a *size grid*: one quantity box
 *   per size the catalog carries for that model and colour. The shop thinks in
 *   size runs ("10×S 20×M 20×L"), so one row of boxes replaces what used to be
 *   one dialog per size. Each box with a quantity becomes one garment line;
 *   the size option's value *is* the variant id, so a phantom SKU is
 *   structurally impossible. A row can be switched to free text for garments
 *   the catalog doesn't carry (and for customer-supplied ones) — such a line
 *   is not stock-tracked, and the row says so.
 * - **Designs** (`textile_designs`): one row per design applied to the whole
 *   batch — an order file or typed-out text, plus placement, size and print
 *   method. Declared once ("logo, chest left, large") and valid for every line.
 *   Designs arrive through the shared `FilePicker` above the rows — drop files
 *   (or click to browse) to link them to the order and apply them in one go,
 *   or apply a file the order already has — plus the editor's own *Text* tab
 *   for a typed-out design. Placement and size are then picked one step at a
 *   time, like the garments.
 *
 * Both drafts are local state, folded into the values handed to
 * `validateProduct` and to the textile arm of `ProductWriteInput`, which the
 * product write replaces wholesale.
 */

import { useContext, useEffect, useRef, useState } from 'react'
import { ChevronRight, FileText, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validateProduct } from '../../../lib/products/registry'
import { textileDesignToRow, textileGarmentToLine } from '../../../lib/products/schemas/textile'
import { useSaveProduct } from '../../../queries/productQueries'
import { useRevealFile } from '../../../hooks/useRevealFile'
import {
  useTextileBrandNames,
  useTextileColors,
  useTextileModelNames,
  useTextileSizes,
} from '../../../queries/textileCatalogQueries'
import { textileService } from '../../../services/textileService'
import type { FileRow } from '../../../services/fileService'
import type { ProductWriteInput, TextileDesignRow, TextileGarmentLineRow } from '../../../types/product'
import { FilePicker } from '../../FilePicker'
import { useToast } from '../../Toast'
import { Badge } from '../../ui/badge'
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
  textileOptionLabel,
  type TextileOption,
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

const emptyDesign = (type: DesignDraft['type']): DesignDraft => ({
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

// --- Guided steps -----------------------------------------------------------

type StepOption = TextileOption & { colorHex?: string | null }

/** Lists longer than this get a filter box above them. */
const FILTERABLE_FROM = 8

/**
 * One step of a guided pick: a question and the options answering it, as one
 * list — the same list the new-order dialog offers its customers in. The
 * editors show one step at a time, so the user is asked for the brand, then
 * the model, then the colour, instead of facing every field at once. `step`
 * names the step for the e2e suite; `loading` and `failed` are the state of
 * the list's query, where there is one.
 */
function OptionStep({
  step,
  title,
  options,
  loading = false,
  failed = false,
  emptyText = 'Nothing to choose from.',
  onPick,
}: {
  step: string
  title: string
  options: StepOption[]
  loading?: boolean
  failed?: boolean
  emptyText?: string
  onPick: (option: StepOption) => void
}) {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const shown = needle === '' ? options : options.filter(option => option.label.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {options.length > FILTERABLE_FROM && (
        <Input
          type="search"
          placeholder="Filter…"
          aria-label={`Filter ${title.toLowerCase()}`}
          className="h-8"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
      )}
      <div className="max-h-64 overflow-y-auto rounded-md border">
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
        ) : failed ? (
          <p className="px-3 py-2 text-xs text-destructive">The catalog could not be loaded.</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{options.length === 0 ? emptyText : 'No match'}</p>
        ) : (
          shown.map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={IDS.stepOption}
              data-step={step}
              data-value={option.value}
              onClick={() => onPick(option)}
              className="flex w-full cursor-pointer items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none"
            >
              {option.colorHex && <ColorSwatch hex={option.colorHex} />}
              <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/** A catalog colour's swatch; the hex comes from the data, so it cannot be a token. */
function ColorSwatch({ hex }: { hex: string }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: hex }} />
}

/**
 * A pick already made in a guided step, shown in the trail above the current
 * step. Clicking it reopens that step; without `onChange` (a read-only form,
 * or a stored row still resolving its ids) it is a plain badge.
 */
function StepPick({
  step,
  label,
  colorHex,
  onChange,
}: {
  step: string
  label: string
  colorHex?: string | null
  onChange?: () => void
}) {
  const readOnly = useContext(ProductViewContext)
  if (readOnly || !onChange) {
    return (
      <Badge variant="secondary" data-testid={IDS.stepPick} data-step={step}>
        {colorHex && <ColorSwatch hex={colorHex} />}
        {label}
      </Badge>
    )
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      data-testid={IDS.stepPick}
      data-step={step}
      title="Change"
      onClick={onChange}
    >
      {colorHex && <ColorSwatch hex={colorHex} />}
      {label}
    </Button>
  )
}

/** The chevron between two picks of a trail. */
function PickSeparator() {
  return <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
}

// --- Garment rows -----------------------------------------------------------

/**
 * One catalog row, picked one step at a time: brand → model → colour, each a
 * list of buttons, then a quantity box per size that colour is carried in.
 * The picks made so far sit above the current step as a trail; clicking one
 * reopens that step. A stored row arrives with its labels but without its ids
 * until {@link useResolvePrefilledRows} has walked them back from the variant,
 * so it shows its trail and waits for the grid rather than asking for a brand.
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
  const brands = useTextileBrandNames()
  const models = useTextileModelNames(row.brandId)
  const colors = useTextileColors(row.modelId)
  const sizes = useTextileSizes(row.modelId, row.color)

  const resolving = row.modelId === '' && Object.keys(row.quantities).length > 0
  const step = resolving
    ? 'resolving'
    : !row.brandId
      ? 'brand'
      : !row.modelId
        ? 'model'
        : !row.color
          ? 'color'
          : 'sizes'
  const colorHex = colors.data?.find(option => option.color === row.color)?.color_hex ?? null

  // Reopening a step drops everything picked after it, quantities included —
  // they are keyed by variants that belong to the old model and colour.
  const reopenBrand = () => onChange({ brandId: '', brand: '', modelId: '', model: '', color: '', quantities: {} })
  const reopenModel = () => onChange({ modelId: '', model: '', color: '', quantities: {} })
  const reopenColor = () => onChange({ color: '', quantities: {} })

  return (
    <div className="flex flex-col gap-2">
      {row.brand !== '' && (
        <div className="flex flex-wrap items-center gap-1">
          <StepPick step="brand" label={row.brand} onChange={resolving ? undefined : reopenBrand} />
          {row.model !== '' && (
            <>
              <PickSeparator />
              <StepPick step="model" label={row.model} onChange={resolving ? undefined : reopenModel} />
            </>
          )}
          {row.color !== '' && (
            <>
              <PickSeparator />
              <StepPick step="color" label={row.color} colorHex={colorHex} onChange={resolving ? undefined : reopenColor} />
            </>
          )}
        </div>
      )}

      {step === 'resolving' && <p className="text-xs text-muted-foreground">Loading sizes…</p>}
      {step === 'brand' && (
        <OptionStep
          step="brand"
          title="Choose a brand"
          loading={brands.isPending}
          failed={brands.isError}
          emptyText="The catalog has no brands yet."
          options={(brands.data ?? []).map(brand => ({ value: brand.id, label: brand.name }))}
          onPick={option => onChange({ brandId: option.value, brand: option.label, modelId: '', model: '', color: '', quantities: {} })}
        />
      )}
      {step === 'model' && (
        <OptionStep
          step="model"
          title={`Choose a ${row.brand} model`}
          loading={models.isPending}
          failed={models.isError}
          emptyText="This brand has no models yet."
          options={(models.data ?? []).map(model => ({ value: model.id, label: model.name }))}
          onPick={option => onChange({ modelId: option.value, model: option.label, color: '', quantities: {} })}
        />
      )}
      {step === 'color' && (
        <OptionStep
          step="color"
          title="Choose a colour"
          loading={colors.isPending}
          failed={colors.isError}
          emptyText="This model is not carried in any colour."
          options={(colors.data ?? []).map(option => ({ value: option.color, label: option.color, colorHex: option.color_hex }))}
          onPick={option => onChange({ color: option.value, quantities: {} })}
        />
      )}
      {step === 'sizes' && (
        sizes.isPending ? (
          <p className="text-xs text-muted-foreground">Loading sizes…</p>
        ) : sizes.isError ? (
          <p className="text-xs text-destructive">The sizes could not be loaded.</p>
        ) : (sizes.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">This colour is not carried in any size.</p>
        ) : (
          // The size run as one row of boxes: how the shop states a textile order.
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Pieces per size</p>
            <div className="flex flex-wrap gap-2">
              {(sizes.data ?? []).map(size => (
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
  // The editor never stands empty: removing the last row leaves a fresh one,
  // so the brand list is right there for the next garment.
  const removeRow = (key: string) => {
    const remaining = rows.filter(other => other.key !== key)
    onChange(remaining.length > 0 ? remaining : [emptyCatalogRow()])
  }
  // The next garment is offered once every row has its garment identified —
  // while one is still being picked, that pick is the thing to finish.
  const canAddAnother = rows.every(
    row => row.mode === 'FREE_TEXT' || row.color !== '' || Object.keys(row.quantities).length > 0,
  )

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
                onClick={() => removeRow(row.key)}
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
      {!readOnly && canAddAnother && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          data-testid={IDS.addGarment}
          onClick={() => onChange([...rows, emptyCatalogRow()])}
        >
          <Plus /> Add another garment
        </Button>
      )}
    </section>
  )
}

// --- Designs ----------------------------------------------------------------

/**
 * The *Text* tab of the design picker — the one design source that is not a
 * file, so it is the batch editor's own tab rather than part of the shared
 * picker. `fold` collapses the picker again, as applying a file does.
 */
function TextDesignTab({ onAddText, fold }: { onAddText: (content: string) => void; fold: () => void }) {
  const [text, setText] = useState('')

  const addText = () => {
    const content = text.trim()
    if (content === '') return
    onAddText(content)
    setText('')
    fold()
  }

  return (
    <div className="flex min-h-28 flex-col justify-center gap-2 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">What should it say?</p>
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1"
          placeholder="Text"
          aria-label="Text"
          data-testid={IDS.pickerText}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            // Enter adds the design; the form's submit is left alone.
            if (event.key !== 'Enter') return
            event.preventDefault()
            addText()
          }}
        />
        <Button type="button" size="sm" data-testid={IDS.addDesign} disabled={text.trim() === ''} onClick={addText}>
          <Plus /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Colour and font follow on the design once it is added.</p>
    </div>
  )
}

/**
 * One design, settled one step at a time: its placement, then its application
 * size, then the optional print method. A file design is named by its order
 * file; a text design states its text, colour and font above the steps.
 */
function DesignRow({
  design,
  file,
  onChange,
  onRemove,
}: {
  design: DesignDraft
  /** The design's order file, or `null` when the file is gone (or the design is text). */
  file: FileRow | null
  onChange: (patch: Partial<DesignDraft>) => void
  onRemove: () => void
}) {
  const readOnly = useContext(ProductViewContext)
  const revealFile = useRevealFile()
  const step = !design.placement ? 'placement' : !design.size ? 'size' : 'done'

  return (
    <div data-testid={IDS.designRow} data-design-type={design.type} className="flex items-start gap-2 rounded-md border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {design.type === 'FILE' ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-primary" aria-hidden />
            {file ? (
              <button
                type="button"
                title={`Open in file manager\n${file.path}`}
                onClick={() => void revealFile(file.path)}
                className="min-w-0 cursor-pointer truncate rounded-sm text-left font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {file.display_name}
              </button>
            ) : (
              <span className="min-w-0 truncate font-medium text-destructive">This file is no longer linked to the order</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 w-56" placeholder="Text" aria-label="Text" value={design.content} onChange={event => onChange({ content: event.target.value })} />
            <Input className="h-8 w-28" placeholder="#FFFFFF" aria-label="Colour" value={design.color} onChange={event => onChange({ color: event.target.value })} />
            <Select value={design.font_class || undefined} onValueChange={font_class => onChange({ font_class })}>
              <SelectTrigger size="sm" className="w-36" aria-label="Font"><SelectValue placeholder="Font…" /></SelectTrigger>
              <SelectContent>
                {TEXTILE_FONT_CLASS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-8 w-40" placeholder="Font name (optional)" aria-label="Font name" value={design.font_name} onChange={event => onChange({ font_name: event.target.value })} />
          </div>
        )}

        {design.placement !== '' && (
          <div className="flex flex-wrap items-center gap-1">
            <StepPick
              step="placement"
              label={textileOptionLabel(TEXTILE_PLACEMENT_OPTIONS, design.placement)}
              onChange={() => onChange({ placement: '' })}
            />
            {design.size !== '' && (
              <>
                <PickSeparator />
                <StepPick
                  step="size"
                  label={textileOptionLabel(TEXTILE_APPLICATION_SIZE_OPTIONS, design.size)}
                  onChange={() => onChange({ size: '' })}
                />
              </>
            )}
          </div>
        )}

        {step === 'placement' && (
          <OptionStep step="placement" title="Where does it go?" options={TEXTILE_PLACEMENT_OPTIONS} onPick={option => onChange({ placement: option.value })} />
        )}
        {step === 'size' && (
          <OptionStep step="size" title="How large?" options={TEXTILE_APPLICATION_SIZE_OPTIONS} onPick={option => onChange({ size: option.value })} />
        )}
        {step === 'done' && (!readOnly || design.print_method !== '') && (
          <Input
            className="h-8 w-56"
            placeholder="Print method (optional)"
            aria-label="Print method"
            value={design.print_method}
            onChange={event => onChange({ print_method: event.target.value })}
          />
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
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

/**
 * The batch's designs. A design is declared once and holds for every garment
 * line, so there is no per-line application: one row = one design at one
 * placement (which the table's UNIQUE (product_id, placement) enforces).
 * Every design comes in through the picker below the rows — artwork dropped,
 * an order file, or a text.
 */
function DesignsEditor({
  orderId,
  designs,
  orderFiles,
  error,
  onChange,
}: {
  orderId: string
  designs: DesignDraft[]
  orderFiles: FileRow[]
  error?: string
  onChange: (next: DesignDraft[]) => void
}) {
  const readOnly = useContext(ProductViewContext)
  const patchDesign = (key: string, patch: Partial<DesignDraft>) =>
    onChange(designs.map(design => (design.key === key ? { ...design, ...patch } : design)))

  const usage = new Map<string, number>()
  for (const design of designs) {
    if (design.type === 'FILE' && design.file_id) usage.set(design.file_id, (usage.get(design.file_id) ?? 0) + 1)
  }
  const filesById = new Map(orderFiles.map(file => [file.id, file]))

  return (
    <section data-testid={IDS.designs} className="flex flex-col gap-2">
      <SectionHeader title="Designs" />
      {designs.map(design => (
        <DesignRow
          key={design.key}
          design={design}
          file={design.type === 'FILE' ? (filesById.get(design.file_id) ?? null) : null}
          onChange={patch => patchDesign(design.key, patch)}
          onRemove={() => onChange(designs.filter(other => other.key !== design.key))}
        />
      ))}
      {!readOnly && (
        <FilePicker
          orderId={orderId}
          orderFiles={orderFiles}
          hasPicks={designs.length > 0}
          collapsedLabel="Add another design"
          // A design may take several placements, so an applied file stays
          // pickable; the badge says how often it is already in.
          fileBadge={file => {
            const applied = usage.get(file.id) ?? 0
            if (applied === 0) return null
            return <Badge variant="secondary">{applied === 1 ? 'Applied once' : `Applied ${applied}×`}</Badge>
          }}
          extraTabs={[
            {
              value: 'text',
              label: 'Text',
              triggerTestId: IDS.pickerTextTab,
              render: fold => (
                <TextDesignTab onAddText={content => onChange([...designs, { ...emptyDesign('TEXT'), content }])} fold={fold} />
              ),
            },
          ]}
          onPick={fileIds => onChange([...designs, ...fileIds.map(file_id => ({ ...emptyDesign('FILE'), file_id }))])}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
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
  // A new batch opens with one garment row (the brand list) and no design —
  // the design picker is the invitation.
  const [designs, setDesigns] = useState<DesignDraft[]>(() =>
    batch ? designsFromRows(batch.designs) : [],
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
        orderId={props.orderId}
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
