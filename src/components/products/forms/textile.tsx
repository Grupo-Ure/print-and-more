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
 *
 * This file is the form's shell: it holds both drafts and the save. The two
 * editors are a file each (`textileGarments.tsx`, `textileDesigns.tsx`) —
 * they share nothing but the guided-step pieces (`guidedSteps.tsx`) and meet
 * only here. The drafts and their conversions are pure and live beside the
 * schema (`lib/products/textileBatchDraft.ts`). `useResolvePrefilledRows`
 * stays here: it is the shell's own wiring of a stored batch into the garment
 * draft, with this form as its one caller.
 */

import { useEffect, useState } from 'react'
import { validateProduct } from '../../../lib/products/registry'
import { textileDesignToRow, textileGarmentToLine } from '../../../lib/products/schemas/textile'
import {
  batchTotal,
  designsFromRows,
  emptyCatalogRow,
  flattenDesigns,
  flattenGarments,
  garmentRowsFromLines,
  type DesignDraft,
  type GarmentRowDraft,
} from '../../../lib/products/textileBatchDraft'
import { useSaveProduct } from '../../../queries/productQueries'
import { useTextileVariantCascades } from '../../../queries/textileCatalogQueries'
import type { ProductWriteInput } from '../../../types/product'
import { useToast } from '../../Toast'
import { FormActions, FormShell } from './fields'
import type { ProductFormProps } from './shared'
import { DesignsEditor } from './textileDesigns'
import { GarmentsEditor } from './textileGarments'

/** Nothing to report while the walk is still out. */
const NO_UNRESOLVED_ROWS: Set<string> = new Set()

/** The variant a stored row's size grid is resolved from: the first it is keyed by. */
const resolveFrom = (row: GarmentRowDraft & { mode: 'CATALOG' }): string => Object.keys(row.quantities)[0]

/** A stored catalog row that still has to find the model its grid belongs to. */
const isUnresolved = (row: GarmentRowDraft): row is GarmentRowDraft & { mode: 'CATALOG' } =>
  row.mode === 'CATALOG' && row.modelId === '' && Object.keys(row.quantities).length > 0

/**
 * Resolve each stored catalog row's model and brand from the variant its
 * quantities are keyed by — a `textile_garments` line references the variant,
 * not the model, so the grid's cascade has to be walked back up once before it
 * can show the full size run.
 *
 * The walk is a cached query over those rows' variants rather than a one-shot
 * fetch of its own: the result belongs to the cache, so it is applied by
 * whichever render has it, and no row can be left waiting for a fetch that an
 * earlier render abandoned. Writing the ids back ends the walk by itself — a
 * row that holds its model is no longer unresolved, so it drops out of the
 * query.
 *
 * Returns the keys of the rows whose variant did not come back — in practice a
 * failed read, since deleting a variant nulls the line's `variant_id` and the
 * line is read back as free text — so such a row can say the sizes could not be
 * loaded instead of waiting for a size run that will never arrive.
 */
function useResolvePrefilledRows(
  rows: GarmentRowDraft[],
  setRows: (update: (previous: GarmentRowDraft[]) => GarmentRowDraft[]) => void,
): Set<string> {
  const unresolved = rows.filter(isUnresolved)
  const cascades = useTextileVariantCascades(unresolved.map(resolveFrom))
  const resolutions = cascades.data

  useEffect(() => {
    if (!resolutions || resolutions.length === 0) return
    setRows(previous =>
      previous.map(row => {
        if (!isUnresolved(row)) return row
        const hit = resolutions.find(resolution => resolution.variantId === resolveFrom(row))
        return hit ? { ...row, brandId: hit.brandId, modelId: hit.modelId, color: hit.color } : row
      }),
    )
  }, [resolutions, setRows])

  if (cascades.isPending) return NO_UNRESOLVED_ROWS
  return new Set(
    unresolved
      .filter(row => !(resolutions ?? []).some(resolution => resolution.variantId === resolveFrom(row)))
      .map(row => row.key),
  )
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
  const unresolvedRowKeys = useResolvePrefilledRows(rows, setRows)

  const garments = flattenGarments(rows)
  const designValues = flattenDesigns(designs)
  const errors = validateProduct('TEXTILE_GARMENT', { garments, designs: designValues })
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
    <FormShell onSubmit={handleSubmit} className="flex flex-col gap-4">
      <GarmentsEditor
        rows={rows}
        unresolvedRowKeys={unresolvedRowKeys}
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
        submitting={saveProduct.isPending}
        editing={!!props.product}
        onCancel={props.onCancel}
      />
    </FormShell>
  )
}
