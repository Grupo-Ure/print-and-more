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

import { useEffect, useRef, useState } from 'react'
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
import { textileService } from '../../../services/textileService'
import type { ProductWriteInput } from '../../../types/product'
import { useToast } from '../../Toast'
import { FormActions, FormShell } from './fields'
import type { ProductFormProps } from './shared'
import { DesignsEditor } from './textileDesigns'
import { GarmentsEditor } from './textileGarments'

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
