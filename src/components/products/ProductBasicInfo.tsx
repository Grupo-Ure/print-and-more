/**
 * The product's **Basic info** tab: its own per-type form, inline.
 *
 * Under the job model a job held a list of products, so the spec lived in a
 * table whose rows opened a dialog. A product is the unit of work now, so the
 * detail view shows exactly one spec and there is nothing to list: the form is
 * the tab. It renders read-only (`ProductViewContext` + a disabled fieldset,
 * the same mechanism the old dialog used for view mode) until *Edit* is
 * pressed, and goes back to read-only on save or cancel.
 *
 * Products are read-only for good once the product is in production or done,
 * in which case no Edit button is offered at all.
 */

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { FileRow } from '../../services/fileService'
import type { StockShortage } from '../../services/productionReleaseService'
import type { LoadedProduct } from '../../types/product'
import type { OrderDetailRow } from '../../types/database'
import { Button } from '../ui/button'
import { ProductViewContext } from './forms/formContexts'
import { FORM_BY_TYPE } from './productTypes'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.basicInfo

export function ProductBasicInfo({
  order,
  product,
  orderFiles,
  fileIds,
  shortages,
}: {
  order: OrderDetailRow
  product: LoadedProduct
  orderFiles: FileRow[]
  /** The files currently linked to this product (edit prefill). */
  fileIds: string[]
  /** Shortages blocking this product's release — the textile grid highlights the short sizes. */
  shortages: StockShortage[]
}) {
  const [editing, setEditing] = useState(false)
  const ActiveForm = FORM_BY_TYPE[product.type]

  // Released work is not corrected here; the production banner says why.
  const locked = product.status === 'IN_PRODUCTION' || product.status === 'DONE'
  const viewing = !editing || locked

  if (!ActiveForm) {
    return (
      <p data-testid={IDS.root} className="text-sm text-destructive">
        Unknown product type “{product.type}” — this build has no form for it.
      </p>
    )
  }

  return (
    <section data-testid={IDS.root} data-type={product.type} className="flex flex-col gap-3">
      {viewing && !locked && (
        <div>
          <Button type="button" size="sm" data-testid={IDS.edit} onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        </div>
      )}
      <ProductViewContext.Provider value={viewing}>
        <fieldset disabled={viewing} className="contents">
          <ActiveForm
            // A fresh form per product and per mode switch, so the draft never
            // survives a cancel or a step to the next product.
            key={`${product.id}:${viewing ? 'view' : 'edit'}`}
            orderId={order.id}
            department={product.department}
            product={product}
            orderFiles={orderFiles}
            initialFileIds={fileIds}
            sortOrder={product.sort_order}
            shortages={shortages}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </fieldset>
      </ProductViewContext.Provider>
    </section>
  )
}
