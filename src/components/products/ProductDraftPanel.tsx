/**
 * The unsaved product: its type's own form, inline in the detail pane.
 *
 * Adding a product used to be a dialog, because under the job model a job held
 * a list of products and a row had to open somewhere. A product is the unit of
 * work now and the detail pane shows exactly one, so a product being added is
 * shown where a product is shown — as a draft row in the list with its form
 * beside it. The department and type are settled before this renders (the add
 * button and its type menu), and the form is the same one the Basic info tab
 * edits, with `product={null}`: it validates against the type's Zod schema and
 * only then writes, so a stored product still always has a valid spec.
 *
 * No workflow header and no tabs: assignee, status, release, PDF, time logs,
 * settings and files all need a persisted row. They appear the moment the save
 * turns the draft into an ordinary selected product.
 */

import type { ProductDraft } from '../../context/navigation.context'
import type { FileRow } from '../../services/fileService'
import { useOrderSelection } from '../../hooks/useOrderSelection'
import { departmentLabel } from '../../lib/departmentLabels'
import { PRODUCT_TYPE_LABELS } from '../../lib/productTypeLabels'
import { FORM_BY_TYPE } from './productTypes'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDraft

export function ProductDraftPanel({
  orderId,
  draft,
  orderFiles,
  sortOrder,
}: {
  orderId: string
  draft: ProductDraft
  orderFiles: FileRow[]
  /** Append index for the new product's `sort_order`. */
  sortOrder: number
}) {
  const { setActiveProduct, clearProductDraft } = useOrderSelection()
  const ActiveForm = FORM_BY_TYPE[draft.type]

  const department = departmentLabel(draft.department)
  const typeLabel = PRODUCT_TYPE_LABELS[draft.type] ?? draft.type
  // The OTHER department's single type is called "Other" as well, and
  // "Other - New Other" only stutters.
  const heading = typeLabel === department ? 'New product' : `New ${typeLabel}`

  if (!ActiveForm) {
    return (
      <p data-testid={IDS.root} className="text-sm text-destructive">
        Unknown product type “{draft.type}” — this build has no form for it.
      </p>
    )
  }

  return (
    <section
      data-testid={IDS.root}
      data-department={draft.department}
      data-type={draft.type}
      className="flex flex-1 flex-col gap-4"
    >
      {/* Mirrors the product header's place so the pane does not jump when the
          draft becomes a product, without offering any of its actions. */}
      <div className="flex flex-col gap-2 pt-2">
        <h1 data-testid={IDS.title} className="flex items-baseline gap-2">
          {department}
          <span>-</span>
          <span className="text-muted-foreground">{heading}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Fill the product in and press Add product. It gets its number once saved.
        </p>
      </div>

      <ActiveForm
        orderId={orderId}
        department={draft.department}
        product={null}
        orderFiles={orderFiles}
        initialFileIds={[]}
        sortOrder={sortOrder}
        // Selecting the saved product clears the draft, so the pane switches to
        // the real `ProductDetail` in the same update.
        onSaved={(_products, productId) => setActiveProduct(productId)}
        onCancel={clearProductDraft}
      />
    </section>
  )
}
