import type { ReactElement } from 'react'
import { ArrowRight, Ban, Trash2 } from 'lucide-react'
import { useProductRelease } from '../hooks/useProductRelease'
import { useProductRemoval } from '../hooks/useProductRemoval'
import type { LoadedProduct } from '../types/product'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productList.contextMenu

type Props = {
  product: LoadedProduct
  orderNumber: string | null
  /** The row that opens the menu on right-click. */
  children: ReactElement
}

/**
 * Right-click menu for a row of the product list: advance the product to its
 * next workflow stage, or delete/cancel it. The items mount only while the menu
 * is open, so their queries (stock) run on demand for that product.
 */
export function ProductContextMenu({ product, orderNumber, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ProductContextMenuItems product={product} orderNumber={orderNumber} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ProductContextMenuItems({ product, orderNumber }: Omit<Props, 'children'>) {
  const release = useProductRelease(product, orderNumber)
  const removal = useProductRemoval(product)

  return (
    <>
      {release.label != null && (
        <>
          <ContextMenuItem
            data-testid={IDS.advance}
            data-target={release.target ?? undefined}
            disabled={release.disabled}
            onSelect={() => void release.advance()}
          >
            <ArrowRight />
            {release.label}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {removal.canDelete ? (
        <ContextMenuItem
          data-testid={IDS.delete}
          variant="destructive"
          disabled={removal.pending}
          onSelect={() => void removal.requestDelete()}
        >
          <Trash2 />
          Delete product
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          data-testid={IDS.cancel}
          variant="destructive"
          disabled={!removal.canCancel || removal.pending}
          onSelect={() => void removal.requestCancel()}
        >
          <Ban />
          Cancel product
        </ContextMenuItem>
      )}
    </>
  )
}
