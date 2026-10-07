/**
 * The garment half of the textile batch form (`textile_garments`): one row per
 * model × colour, picked from the catalog one step at a time and expanded into
 * a size grid, or described as free text. See `textile.tsx` for the form.
 */

import { useContext } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionHeader } from '@/components/ui/section-title'
import { emptyCatalogRow, emptyFreeTextRow, type GarmentRowDraft } from '@/lib/products/textileBatchDraft'
import { TEXTILE_GARMENT_TYPE_OPTIONS, TEXTILE_ORIGIN_OPTIONS } from '@/lib/textileOptions'
import { cn } from '@/lib/utils'
import {
  useTextileBrandNames,
  useTextileColors,
  useTextileModelNames,
  useTextileSizes,
} from '@/queries/textileCatalogQueries'
import { TEST_IDS } from '@e2e/support/testIds'
import { OptionStep, PickSeparator, StepPick } from './guidedSteps'
import { ProductViewContext, useSubmitAttempted } from './formContexts'

const IDS = TEST_IDS.orders.productDetail.basicInfo.textile

/**
 * One catalog row, picked one step at a time: brand → model → colour, each a
 * list of buttons, then a quantity box per size that colour is carried in.
 * The picks made so far sit above the current step as a trail; clicking one
 * reopens that step. A stored row arrives with its labels but without its ids
 * until the form (`useResolvePrefilledRows`) has walked them back from the
 * variant, so it shows its trail and waits for the grid rather than asking for
 * a brand — and says as much when that walk comes back empty (`unresolved`),
 * rather than waiting on it for good.
 */
function CatalogGarmentRow({
  row,
  unresolved,
  shortVariantIds,
  onChange,
}: {
  row: GarmentRowDraft & { mode: 'CATALOG' }
  unresolved: boolean
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

      {step === 'resolving' && (
        unresolved ? (
          // The lines themselves are intact — they keep their labels, their
          // sizes and their quantities, and are saved as they stand.
          <p className="text-xs text-destructive">
            This garment could not be looked up in the catalog; its sizes cannot be changed here.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Loading sizes…</p>
        )
      )}
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

export function GarmentsEditor({
  rows,
  unresolvedRowKeys,
  shortVariantIds,
  error,
  total,
  onChange,
}: {
  rows: GarmentRowDraft[]
  /** Stored rows whose variant did not come back from the catalog. */
  unresolvedRowKeys: Set<string>
  shortVariantIds: Set<string>
  error?: string
  total: number
  onChange: (next: GarmentRowDraft[]) => void
}) {
  // View mode hides the row actions, as `FormActions` hides the footer.
  const readOnly = useContext(ProductViewContext)
  // The batch error waits for a save attempt, like every field error does.
  const shownError = useSubmitAttempted() ? error : undefined
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
                unresolved={unresolvedRowKeys.has(row.key)}
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
      {shownError && <p className="text-xs text-destructive">{shownError}</p>}
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
