/**
 * Shared modal shell for the product dialogs. Owns everything the department
 * dialogs have in common: the Dialog chrome, the add/edit/view title, the
 * order-level QUOTE lookup, read-only view mode (context + disabled fieldset),
 * and the view-mode Edit/Close footer. The department dialogs only supply the
 * content — a type picker and/or their form — via the render-prop `children`.
 */

import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import type { JobRow } from '../../types/database'
import type { LoadedProduct } from '../../types/product'
import { useOrderById } from '../../queries/orderQueries'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { ProductViewContext } from './forms/viewContext'
import type { useProductEditor } from './useProductEditor'

type ProductEditor = ReturnType<typeof useProductEditor>

export type ProductDialogContext = {
  /** The product being edited or viewed, `null` when adding. */
  product: LoadedProduct | null
  /** True while the parent order is a QUOTE — nothing is required yet. */
  orderIsQuote: boolean
  /** sort_order to persist: the product's own, or the append index. */
  sortOrder: number
}

export function ProductDialogShell({
  editor,
  job,
  noun = 'product',
  onClose,
  children,
}: {
  editor: ProductEditor
  job: JobRow
  /** Lower-case noun for the titles ("product", "garment"). */
  noun?: string
  /** Extra cleanup run on every close path (X, overlay, Close button). */
  onClose?: () => void
  children: (ctx: ProductDialogContext) => ReactNode
}) {
  const { mode, close, products, openEdit, isReadOnly } = editor
  // The quote-relaxation of the product validation is an order-level rule.
  const orderIsQuote = useOrderById(job.order_id).data?.status === 'QUOTE'

  const editing = mode.kind === 'edit' ? mode.product : null
  const viewing = mode.kind === 'view' ? mode.product : null
  const product = editing ?? viewing

  const handleClose = () => {
    onClose?.()
    close()
  }

  const capitalized = noun.charAt(0).toUpperCase() + noun.slice(1)
  const title = viewing ? `${capitalized} details` : editing ? `Edit ${noun}` : `Add ${noun}`

  return (
    <Dialog open={mode.kind !== 'idle'} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ProductViewContext.Provider value={viewing !== null}>
          <fieldset disabled={viewing !== null} className="contents">
            {children({
              product,
              orderIsQuote,
              sortOrder: product ? product.sort_order : products.length,
            })}
          </fieldset>
        </ProductViewContext.Provider>
        {viewing && !isReadOnly && (
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={() => openEdit(viewing)}>
              <Pencil /> Edit
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
