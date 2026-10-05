import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatMinutes } from '../lib/formatMinutes'
import {
  isDeadlineMissed,
  isMissingInfo,
  resolveEffectiveProduct,
  shortProductNumber,
} from '../lib/productShared'
import { DEPARTMENTS, type Department, type ProductStatus } from '../types/database'
import { departmentLabel } from '../lib/departmentLabels'
import type { FileRow } from '../services/fileService'
import { useOrderSelection } from '../hooks/useOrderSelection'
import { useOrderById } from '../queries/orderQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { useTimeLogMinutesByOrderId } from '../queries/timeLogQueries'
import { AddProductDialog } from './products/AddProductDialog'
import { ProductContextMenu } from './ProductContextMenu'
import { DeadlineMissedFlag, HighPriorityFlag, MissingInfoFlag } from './Flags'
import { Button } from './ui/button'
import { PRODUCT_STATUS_META, WORKFLOW_STATUSES } from '../lib/statusLabels'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productList

function ProductStatusTrack({ status }: { status: ProductStatus }) {
  return (
    <div className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-gray-100">
      {WORKFLOW_STATUSES.map(s => (
        <div
          key={s}
          title={PRODUCT_STATUS_META[s].label}
          className={cn('w-2.5 h-2.5', s === status ? PRODUCT_STATUS_META[s].color : 'bg-gray-200')}
        />
      ))}
    </div>
  )
}

/** The order's products, one row each, with the add-product buttons above them. */
export function ProductList({ orderFiles }: { orderFiles: FileRow[] }) {
  const { activeOrderId, activeProductId, setActiveProduct } = useOrderSelection()
  const productsQuery = useProductsByOrderId(activeOrderId)
  const orderQuery = useOrderById(activeOrderId)
  const minutesQuery = useTimeLogMinutesByOrderId(activeOrderId)

  const visibleProducts = (productsQuery.data ?? []).filter(product => !product.is_cancelled)
  const order = orderQuery.data
  const minutesByProduct = minutesQuery.data

  return (
    <nav data-testid={IDS.root} className="flex flex-col gap-1 w-48 desktop:w-60 shrink-0">
        <h1>Products in this order</h1>
        <AddProductButtons
          orderFiles={orderFiles}
          sortOrder={(productsQuery.data ?? []).length}
        />
        {visibleProducts.length === 0 && !productsQuery.isLoading ? (
          // Takes the list's space so the hint sits in the middle of the column.
          <p
            data-testid={IDS.empty}
            className="flex flex-1 items-center justify-center p-2 text-center text-sm text-muted-foreground"
          >
            No products yet.
          </p>
        ) : (
        <ul data-testid={IDS.list} className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto" aria-label="Products">
          {visibleProducts.map(product => (
            <ProductContextMenu key={product.id} product={product} orderNumber={order?.order_number ?? null}>
            <li
              data-testid={IDS.row}
              data-product-id={product.id}
              data-status={product.status}
              aria-current={product.id === activeProductId ? 'true' : undefined}
              className={cn(
                'flex items-center justify-between w-full cursor-pointer p-2',
                product.id === activeProductId && 'bg-primary/10',
              )}
              onClick={() => setActiveProduct(product.id)}
              // Right-click selects the row too, so the detail view shows the
              // product the menu is about to act on.
              onContextMenu={() => setActiveProduct(product.id)}
              title={product.product_number}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{shortProductNumber(product.product_number)}</span>
                {order && isMissingInfo(product, order) && (
                  <MissingInfoFlag size={14} testId={IDS.rowMissingInfo} />
                )}
                {order && isDeadlineMissed(product, order) && (
                  <DeadlineMissedFlag size={14} testId={IDS.rowDeadlineMissed} />
                )}
                {/* Effective priority: a product without its own override inherits the order's. */}
                {order && resolveEffectiveProduct(product, order).priority === 'HIGH' && (
                  <HighPriorityFlag size={14} testId={IDS.rowHighPriority} />
                )}
              </span>
              {(minutesByProduct?.[product.id] ?? 0) > 0 && (
                <span
                  className="text-xs text-muted-foreground tabular-nums shrink-0 px-1"
                  title="Time logged on this product"
                >
                  {formatMinutes(minutesByProduct![product.id])}
                </span>
              )}
              <ProductStatusTrack status={product.status} />
            </li>
            </ProductContextMenu>
          ))}
        </ul>
        )}
    </nav>
  )
}

/**
 * "Add product" group for the active order: one button per department, each
 * opening the add dialog on that department's type picker. The product is
 * created by its type's own form (a product without a spec would be a product
 * without content), and the new row is selected straight away.
 * Renders nothing while the order is finished/billed — closed for new work.
 */
function AddProductButtons({ orderFiles, sortOrder }: { orderFiles: FileRow[]; sortOrder: number }) {
  const { activeOrderId, setActiveProduct } = useOrderSelection()
  const orderQuery = useOrderById(activeOrderId)
  const [department, setDepartment] = useState<Department | null>(null)
  const labelId = useId()

  const order = orderQuery.data
  const locked = order?.status === 'FINISHED' || order?.status === 'BILLED'
  if (locked || !activeOrderId) return null

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
      <span id={labelId} className="text-center text-[11px] font-medium text-muted-foreground">
        Add product
      </span>
      <div className="grid grid-cols-2">
        {DEPARTMENTS.map(option => (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="xs"
            data-testid={IDS.addProduct}
            data-department={option}
            title={`Add a ${departmentLabel(option)} product`}
            // Long labels ("Laser Engraving") wrap onto two lines in the
            // compact list width instead of overflowing the button.
            className="h-auto min-h-6 rounded-none whitespace-normal py-0.5 leading-tight"
            onClick={() => setDepartment(option)}
          >
            {departmentLabel(option)}
          </Button>
        ))}
      </div>

      <AddProductDialog
        orderId={activeOrderId}
        department={department}
        orderFiles={orderFiles}
        sortOrder={sortOrder}
        onCreated={productId => {
          setDepartment(null)
          setActiveProduct(productId)
        }}
        onClose={() => setDepartment(null)}
      />
    </div>
  )
}
