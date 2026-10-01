import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ORDER_STATUS_META } from '../../const/orderStatus'
import { useNavigation } from '../../context/navigation.context'
import { useOrderFiles } from '../../hooks/useOrderFiles'
import { formatDateDe } from '../../lib/formatDate'
import { useProductsByOrderId } from '../../queries/productQueries'
import { useOrderById } from '../../queries/orderQueries'
import { useStatusManager } from '../../queries/useStatusManager'
import { ProductDetail } from '../ProductDetail'
import { StatusBadge } from '../StatusBadge'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.production.productPanel

/**
 * The Production page's main area: the selected product's detail, exactly as the
 * orders view shows it, under a read-only strip naming the order it belongs to.
 * Everything the detail needs from its order (the row, the order's products, the
 * files, the automatic status watcher) is loaded here; the desk's order actions
 * stay on the orders view, one click away.
 */
export function ProductionProductPanel() {
  const { activeOrderId, activeProductId, openProductInOrders } = useNavigation()
  const { data: order, isLoading: orderLoading, isError } = useOrderById(activeOrderId)
  const productsQuery = useProductsByOrderId(activeOrderId)
  const { files, reload: reloadFiles } = useOrderFiles(activeOrderId)

  // Keeps the automatic IN_SETUP ↔ PREPRESS rule running for this order's
  // products while they are edited here — the same one effect per order the
  // orders view runs. Unconditional, because hooks cannot be skipped; it does
  // nothing without an order.
  useStatusManager(activeOrderId)

  if (!activeOrderId || !activeProductId) {
    return (
      <div
        data-testid={TEST_IDS.production.placeholder}
        className="flex flex-1 items-center justify-center p-6 text-center text-neutral-500"
      >
        <p>Select a product on the left to work on it.</p>
      </div>
    )
  }

  if (orderLoading || productsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h2>Loading product…</h2>
      </div>
    )
  }

  const product = productsQuery.data?.find(row => row.id === activeProductId) ?? null
  if (isError || !order || !product) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <h2>Product could not be loaded.</h2>
      </div>
    )
  }

  return (
    <div
      data-testid={IDS.root}
      data-order-id={order.id}
      data-product-id={product.id}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <h2 data-testid={IDS.customerName} className="text-foreground" title="Customer">
            {order.customers?.name?.trim() || '—'}
          </h2>
          <span className="flex items-center gap-1 text-sm desktop:text-base">
            Order:
            <span data-testid={IDS.orderNumber} className="font-medium text-foreground">
              {order.order_number}
            </span>
          </span>
          <span className="text-sm desktop:text-base">
            Deadline: {order.deadline ? formatDateDe(order.deadline) : 'none'}
          </span>
          <StatusBadge meta={ORDER_STATUS_META[order.status]} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={IDS.openInOrders}
          title="Open this order in the orders view"
          onClick={() => openProductInOrders(order.id, product.id)}
        >
          <ExternalLink />
          Open in orders
        </Button>
      </header>

      <Separator />

      <ProductDetail orderFiles={files} onOrderFilesChanged={reloadFiles} />
    </div>
  )
}
