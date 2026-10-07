import { useId } from 'react'
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
import { useOrderSelection } from '../hooks/useOrderSelection'
import { useOrderById } from '../queries/orderQueries'
import { useProductsByOrderId } from '../queries/productQueries'
import { useTimeLogMinutesByOrderId } from '../queries/timeLogQueries'
import { ProductContextMenu } from './ProductContextMenu'
import { DeadlineMissedFlag, HighPriorityFlag, MissingInfoFlag } from './Flags'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { PRODUCT_TYPES_BY_DEPARTMENT, PRODUCT_TYPE_LABELS } from '../lib/productTypeLabels'
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
export function ProductList() {
  const { activeOrderId, activeProductId, productDraft, setActiveProduct } = useOrderSelection()
  const productsQuery = useProductsByOrderId(activeOrderId)
  const orderQuery = useOrderById(activeOrderId)
  const minutesQuery = useTimeLogMinutesByOrderId(activeOrderId)

  const visibleProducts = (productsQuery.data ?? []).filter(product => !product.is_cancelled)
  const order = orderQuery.data
  const minutesByProduct = minutesQuery.data

  // The listed rows are the saved products plus — last, since its sort_order is
  // the append index — the one being added. The draft is derived here and only
  // here: it must never reach the products query, whose data also drives the
  // automatic status logic and "are all products done".
  const hasRows = visibleProducts.length > 0 || productDraft != null

  return (
    <nav data-testid={IDS.root} className="flex flex-col gap-1 w-48 desktop:w-60 shrink-0">
        <h1>Products in this order</h1>
        <AddProductButtons />
        {!hasRows && !productsQuery.isLoading ? (
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
          {productDraft && (
            <li
              data-testid={IDS.draftRow}
              data-department={productDraft.department}
              data-type={productDraft.type}
              aria-current="true"
              // No status track, flags, time or context menu: there is nothing to
              // release, cancel or print until the product exists.
              className="flex items-center gap-1.5 w-full min-w-0 border border-dashed border-primary/50 bg-primary/10 p-2 italic text-muted-foreground"
              title={`New ${PRODUCT_TYPE_LABELS[productDraft.type] ?? productDraft.type}`}
            >
              <span className="truncate">
                New {PRODUCT_TYPE_LABELS[productDraft.type] ?? productDraft.type}
              </span>
            </li>
          )}
        </ul>
        )}
    </nav>
  )
}

/**
 * "Add product" group for the active order: one button per department, each
 * offering that department's product types in a menu. Picking a type starts an
 * unsaved draft product, which the detail pane shows as its type's own form —
 * created through that form because a product without a spec would be a product
 * without content.
 * Renders nothing while the order is finished/billed — closed for new work.
 */
function AddProductButtons() {
  const { activeOrderId, startProductDraft } = useOrderSelection()
  const orderQuery = useOrderById(activeOrderId)
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
          <AddProductButton
            key={option}
            department={option}
            onPick={type => startProductDraft(option, type)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * One department's add button. A department offering several types drops a menu
 * of them (dismissing it is how one backs out, so there is no "back" step);
 * Textile and Other offer one type, so their button starts the draft on the
 * spot rather than opening a menu of one.
 */
function AddProductButton({
  department,
  onPick,
}: {
  department: Department
  onPick: (type: string) => void
}) {
  const types = PRODUCT_TYPES_BY_DEPARTMENT[department]
  const onlyType = types.length === 1 ? types[0].value : null

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      data-testid={IDS.addProduct}
      data-department={department}
      title={`Add a ${departmentLabel(department)} product`}
      // Long labels ("Laser Engraving") wrap onto two lines in the
      // compact list width instead of overflowing the button.
      className="h-auto min-h-6 rounded-none whitespace-normal py-0.5 leading-tight"
      onClick={onlyType ? () => onPick(onlyType) : undefined}
    >
      {departmentLabel(department)}
    </Button>
  )

  if (onlyType) return trigger

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {/* Portalled, so the menu is as wide as its labels need, not as the
          narrow button it hangs off. */}
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        <DropdownMenuLabel>What kind of {departmentLabel(department)} product?</DropdownMenuLabel>
        {types.map(option => (
          <DropdownMenuItem
            key={option.value}
            data-testid={IDS.addProductType}
            data-type={option.value}
            onSelect={() => onPick(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
