import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { PRODUCT_STATUS_META } from '../../lib/statusLabels'
import { departmentLabel } from '../../lib/departmentLabels'
import { departmentIcon } from '../../lib/departmentIcons'
import { useNavigation } from '../../context/navigation.context'
import { isDeadlineMissed, isMissingInfo, resolveEffectiveProduct } from '../../lib/productShared'
import { useProductionProducts } from '../../queries/productQueries'
import { useUsers } from '../../queries/userQueries'
import type { ProductionProduct } from '../../services/productService'
import type { UserRow } from '../../services/userService'
import { StatusBadge } from '../StatusBadge'
import { DueDate } from '../DueDate'
import { DeadlineMissedFlag, HighPriorityFlag, MissingInfoFlag } from '../Flags'
import { UserAvatar } from '../UserAvatar'
import { EmployeeCombobox } from '../fields/EmployeeCombobox'
import { useToast } from '../Toast'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.production.sidebar

/**
 * The production feed: every product in pre-press or production across all
 * orders, high priority first, then soonest effective deadline, narrowed to one assignee through
 * the same combobox the product header uses. Everyone starts on their own products.
 * Selecting a row shows the product beside the feed.
 */
export function ProductionSidebar({ currentUserId }: { currentUserId: string }) {
  const { activeProductId, selectProduct } = useNavigation()
  const { data: users = [] } = useUsers()
  const productsQuery = useProductionProducts()
  const { showError } = useToast()

  // The signed-in user is the default; a pick overrides it for this visit.
  // `null` = everyone.
  const [assigneeId, setAssigneeId] = useState<string | null>(currentUserId)
  const { newProductIds, clearNew } = useNewProductMarks(productsQuery.data, assigneeId)

  useEffect(() => {
    if (productsQuery.isError) showError('Production products could not be loaded')
  }, [productsQuery.isError, showError])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const assignee = assigneeId ? usersById.get(assigneeId) ?? null : null

  const products = useMemo(() => {
    const all = productsQuery.data ?? []
    return assigneeId ? all.filter(product => product.assignee_id === assigneeId) : all
  }, [productsQuery.data, assigneeId])

  const isLoading = productsQuery.isLoading
  const isEmpty = !isLoading && products.length === 0
  const hasHighPriority = products.some(isHighPriority)

  return (
    <Sidebar
      collapsible="none"
      side="left"
      data-testid={IDS.root}
      className="shrink-0 border-r! border-gray-200"
    >
      <SidebarHeader className="border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
        <div className="flex min-h-7 items-center justify-between gap-2">
          <h1 className="font-bold uppercase text-neutral-500">Production</h1>
          <EmployeeCombobox
            testId={IDS.assigneeFilter}
            emptyOptionTestId={IDS.assigneeFilterEveryone}
            userOptionTestId={IDS.assigneeFilterUser}
            value={assigneeId}
            emptyLabel="Everyone"
            onChange={user => setAssigneeId(user?.id ?? null)}
          />
        </div>
        <p
          data-testid={IDS.assigneeFilterCaption}
          className="text-[11px] leading-snug text-neutral-500"
        >
          {assignee
            ? `Showing products assigned to ${assignee.name}.`
            : assigneeId
              ? 'Showing products assigned to a deleted user.'
              : 'Showing all products in pre-press and production.'}
        </p>
      </SidebarHeader>

      <SidebarContent className="p-0">
        <div
          data-testid={IDS.list}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto transition-opacity duration-150',
            productsQuery.isFetching && !productsQuery.isLoading ? 'opacity-50' : 'opacity-100',
          )}
        >
          {isLoading && <div className="p-4 text-[13px] text-neutral-500">Loading...</div>}
          {isEmpty && (
            <div
              data-testid={IDS.empty}
              className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-500"
            >
              {assigneeId
                ? 'No products in pre-press or production for this user.'
                : 'No products in pre-press or production.'}
            </div>
          )}
          {!isLoading &&
            products.map((product, index) => {
              // The feed lists high priority first; label both groups, but
              // only when there is a high-priority group to set apart.
              const isHigh = isHighPriority(product)
              const startsGroup =
                hasHighPriority && (index === 0 || isHighPriority(products[index - 1]) !== isHigh)
              return (
                <Fragment key={product.id}>
                  {startsGroup && <PriorityGroupHeader high={isHigh} />}
                  <ProductionSidebarItem
                    product={product}
                    assignee={product.assignee_id ? usersById.get(product.assignee_id) ?? null : null}
                    isActive={product.id === activeProductId}
                    isNew={newProductIds.has(product.id)}
                    onSelect={() => {
                      clearNew(product.id)
                      selectProduct(product.order_id, product.id)
                    }}
                  />
                </Fragment>
              )
            })}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

/**
 * Products that a data update adds to the visible list while the page is open
 * stay marked as new until clicked or the page unmounts: a product entering the
 * feed, or one reassigned to the filtered user. The first load and filter
 * changes never mark anything. A product that leaves and comes back counts as
 * new again.
 */
function useNewProductMarks(products: ProductionProduct[] | undefined, assigneeId: string | null) {
  const [previousProducts, setPreviousProducts] = useState(products)
  const [newProductIds, setNewProductIds] = useState<ReadonlySet<string>>(() => new Set())

  // Compare against the previous fetch during render (React's "adjust state
  // on prop change" pattern), so a new row is marked in its first paint.
  // Both fetches go through the current filter, so only the data can differ.
  if (products !== previousProducts) {
    setPreviousProducts(products)
    if (previousProducts && products) {
      const isVisible = (product: ProductionProduct) =>
        !assigneeId || product.assignee_id === assigneeId
      const before = new Set(previousProducts.filter(isVisible).map(product => product.id))
      const arrived = products
        .filter(product => isVisible(product) && !before.has(product.id))
        .map(product => product.id)
      if (arrived.length > 0) setNewProductIds(marked => new Set([...marked, ...arrived]))
    }
  }

  const clearNew = useCallback((productId: string) => {
    setNewProductIds(marked => {
      if (!marked.has(productId)) return marked
      const next = new Set(marked)
      next.delete(productId)
      return next
    })
  }, [])

  return { newProductIds, clearNew }
}

function isHighPriority(product: ProductionProduct): boolean {
  return resolveEffectiveProduct(product, product.orders).priority === 'HIGH'
}

/** Labelled divider above each priority group of the feed. */
function PriorityGroupHeader({ high }: { high: boolean }) {
  return (
    <div
      data-testid={IDS.priorityGroup}
      data-priority={high ? 'HIGH' : 'NORMAL'}
      className={cn(
        'flex items-center gap-1 border-y px-3 py-1 text-base font-semibold tracking-wide justify-between',
        high ? 'border-red-200 bg-red-50 text-red-400' : 'border-neutral-200 bg-neutral-100 text-neutral-500',
      )}
    >
      {high ? 'High Priority' : 'Products'}
      {high && <ArrowUp size={18} aria-hidden />}
    </div>
  )
}

type ProductionSidebarItemProps = {
  product: ProductionProduct
  assignee: UserRow | null
  isActive: boolean
  isNew: boolean
  onSelect: () => void
}

function ProductionSidebarItem({ product, assignee, isActive, isNew, onSelect }: ProductionSidebarItemProps) {
  const effective = resolveEffectiveProduct(product, product.orders)
  const { icon: DepartmentIcon, colorClassName } = departmentIcon(product.department)
  const label = departmentLabel(product.department)
  const customerName = product.orders.customers?.name ?? '-'

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={IDS.row}
      data-product-id={product.id}
      data-order-id={product.order_id}
      data-status={product.status}
      data-department={product.department}
      data-new={isNew ? 'true' : undefined}
      aria-current={isActive ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'flex cursor-pointer border-l-6 h-32 border-neutral-100 bg-white px-3 py-2 text-left hover:bg-neutral-100 border-t-3',
        isNew && !isActive && 'bg-blue-100',
        isActive && 'border-l-primary bg-primary/10 hover:bg-primary/10',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span title={label} className="inline-flex shrink-0">
              <DepartmentIcon
                size={16}
                className={colorClassName}
                aria-label={label}
              />
            </span>
            <h2
              data-testid={IDS.rowCustomer}
              className="min-w-0 flex-1 truncate font-semibold"
              title={customerName}
            >
              {customerName}
            </h2>
            {isNew && (
              <span
                data-testid={IDS.rowNew}
                title="New — not opened yet"
                className="shrink-0 rounded-full bg-blue-600 px-2 text-[12px] leading-4 text-white"
              >
                New
              </span>
            )}
            {isMissingInfo(product, product.orders) && (
              <MissingInfoFlag size={20} testId={IDS.rowMissingInfo} />
            )}
            {isDeadlineMissed(product, product.orders) && (
              <DeadlineMissedFlag size={20} testId={IDS.rowDeadlineMissed} />
            )}
            {effective.priority === 'HIGH' && <HighPriorityFlag size={20} animate />}
          </div>
          <span
            data-testid={IDS.rowProductNumber}
            className="truncate text-[15px] text-neutral-500"
          >
            {product.product_number}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <DueDate deadline={effective.deadline} testId={IDS.rowDeadline} />
          <span className="flex shrink-0 items-center gap-1.5">
            <span data-testid={IDS.rowStatus} data-status={product.status}>
              <StatusBadge meta={PRODUCT_STATUS_META[product.status]} />
            </span>
            <span
              data-testid={IDS.rowAssignee}
              data-user-id={assignee?.id}
              title={assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}
              className="inline-flex"
            >
              {assignee && 
                <UserAvatar
                  name={assignee.name}
                  avatarUrl={assignee.avatar_url}
                  className="size-8 text-base"
                />
              }
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
