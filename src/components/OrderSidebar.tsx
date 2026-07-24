import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  fetchOrderById,
  invalidateOrderListsIfCustomerReferenced,
  orderKeys,
  patchOrderStatusInCache,
  useDeleteOrder,
  useOrdersList,
  type OrdersListFilter,
} from '../queries/orderQueries'
import { fetchJobsByOrderId } from '../queries/jobQueries'
import { orderService } from '../services/orderService'
import {
  type Auftrag,
  type OrderStatus,
  type JobRow,
} from '../types/database'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { DuplicateDialog } from './DuplicateDialog'
import { NewOrderDialog } from './NewOrderDialog'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
import { useOrderParams } from '../hooks/useOrderParams'
import { OrderSidebarSearch } from './orderSidebar/OrderSidebarSearch'
import { OrderSidebarFilters } from './orderSidebar/OrderSidebarFilters'
import { OrderSidebarBody } from './orderSidebar/OrderSidebarBody'
import { useOrderSidebarFilter } from './orderSidebar/useOrderSidebarFilter'

type OrderInPlace = { tick: number; id: string; status: OrderStatus }

type Props = {
  orderInPlace: OrderInPlace
}

/** Dot on a header icon button signalling a hidden-but-active state. */
function ActiveDot() {
  return (
    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-orange-600 ring-1 ring-white" />
  )
}

export function OrderSidebar({ orderInPlace }: Props) {
  const { activeOrderId, setActiveOrder } = useOrderParams()
  const { filter, isActive: filterActive, selectedStatuses, hasStatusFilter, actions } = useOrderSidebarFilter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterPopOpen, setFilterPopOpen] = useState(false)
  const isCompact = useIsMobile()

  const { showError, showSuccess } = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const deleteOrder = useDeleteOrder()

  const ordersFilter = useMemo<OrdersListFilter>(
    () => ({
      searchDebounced: filter.searchDebounced,
      statusAll: filter.statusAll,
      selectedStatuses,
      deadlineFrom: filter.deadlineFrom,
      deadlineTo: filter.deadlineTo,
      intakeFrom: filter.intakeFrom,
      intakeTo: filter.intakeTo,
      department: filter.department,
    }),
    [filter.searchDebounced, filter.statusAll, selectedStatuses, filter.deadlineFrom, filter.deadlineTo, filter.intakeFrom, filter.intakeTo, filter.department],
  )

  const ordersQuery = useOrdersList(ordersFilter)

  useEffect(() => {
    if (ordersQuery.isError) showError('Orders could not be loaded')
  }, [ordersQuery.isError, showError])

  useEffect(() => {
    if (orderInPlace.tick === 0) return
    patchOrderStatusInCache(queryClient, orderInPlace.id, orderInPlace.status)
  }, [orderInPlace, queryClient])

  useEffect(() => {
    return orderService.subscribeToCustomerChanges(customerId => {
      invalidateOrderListsIfCustomerReferenced(queryClient, customerId)
    })
  }, [queryClient])

  // When no status is selected, the orders query is disabled and may hold stale data — render empty.
  const orders = useMemo(
    () => (hasStatusFilter ? ordersQuery.data ?? [] : []),
    [hasStatusFilter, ordersQuery.data],
  )

  const isEmpty = !ordersQuery.isLoading && orders.length === 0

  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicateOrder, setDuplicateOrder] = useState<Auftrag | null>(null)
  const [duplicateJobs, setDuplicateJobs] = useState<JobRow[]>([])

  const openDuplicateDialog = useCallback(
    async (auftragId: string) => {
      if (duplicateBusy) return
      setDuplicateBusy(true)
      setDuplicateError(null)
      try {
        const orderData = await fetchOrderById(queryClient, auftragId)
        if (!orderData) throw new Error('Order not found')
        const jobData = await fetchJobsByOrderId(queryClient, auftragId)
        setDuplicateOrder(orderData as Auftrag)
        setDuplicateJobs(jobData)
        setDuplicateDialogOpen(true)
      } catch (e) {
        showError('Orders could not be loaded')
        setDuplicateError(e instanceof Error ? e.message : String(e))
      } finally {
        setDuplicateBusy(false)
      }
    },
    [duplicateBusy, queryClient, showError]
  )

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      const target = orders.find(order => order.id === orderId)
      if (!target) return
      if (target.status !== 'QUOTE') return
      const customerLabel = target.customers?.name?.trim() || target.order_number || target.id
      const confirmed = await confirm({
        title: 'Delete order?',
        description: (
          <>
            You are about to permanently delete the quote for{' '}
            <strong className="text-foreground font-medium">{customerLabel}</strong>. All jobs and
            linked files will be removed. This cannot be undone.
          </>
        ),
        confirmLabel: 'Delete order',
        destructive: true,
      })
      if (!confirmed) return
      try {
        await deleteOrder.mutateAsync({ id: target.id })
        showSuccess('Order deleted')
        if (activeOrderId === target.id) setActiveOrder(null)
      } catch {
        showError('Order could not be deleted')
      }
    },
    [orders, confirm, deleteOrder, showSuccess, showError, activeOrderId, setActiveOrder]
  )

  const searchActive = filter.searchInput.trim() !== ''

  return (
    <Sidebar collapsible="none" side="left" className="shrink-0 border-r! border-gray-200">
      <SidebarHeader className="border-b border-neutral-200 px-3.5 py-2.5 bg-neutral-50">
        <div className="flex items-center justify-between gap-2 min-h-7">
          <h1 className="font-bold uppercase text-neutral-500">
            Orders
          </h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Search"
              aria-label="Search"
              aria-pressed={searchOpen}
              onClick={() => setSearchOpen(o => !o)}
              className={cn('relative desktop:hidden', searchOpen && 'bg-muted text-foreground')}
            >
              <Search className="size-3.5" />
              {searchActive && !searchOpen && <ActiveDot />}
            </Button>
            {isCompact ? (
              <Popover open={filterPopOpen} onOpenChange={setFilterPopOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Filter"
                    aria-label="Filter"
                    className="relative"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    {filterActive && <ActiveDot />}
                  </Button>
                </PopoverTrigger>
                <OrderSidebarFilters
                  filter={filter}
                  actions={actions}
                  isActive={filterActive}
                  variant="popover"
                />
              </Popover>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Filter"
                aria-label="Filter"
                aria-pressed={filterPopOpen}
                onClick={() => setFilterPopOpen(o => !o)}
                className={cn('relative', filterPopOpen && 'bg-muted text-foreground')}
              >
                <SlidersHorizontal className="size-3.5" />
                {filterActive && <ActiveDot />}
              </Button>
            )}
          </div>
        </div>

        <OrderSidebarSearch
          value={filter.searchInput}
          onChange={actions.setSearchInput}
          onClear={actions.clearSearch}
          open={searchOpen}
          className={cn('hidden desktop:flex', searchOpen && 'flex')}
        />

        {!isCompact && filterPopOpen && (
          <OrderSidebarFilters
            filter={filter}
            actions={actions}
            isActive={filterActive}
            variant="inline"
          />
        )}
      </SidebarHeader>

      <SidebarContent className="p-0">
        <OrderSidebarBody
          orders={orders}
          activeOrderId={activeOrderId}
          onSelectOrder={setActiveOrder}
          isLoading={ordersQuery.isLoading}
          isFetching={ordersQuery.isFetching}
          isEmpty={isEmpty}
          onResetFilters={actions.reset}
          onDuplicate={orderId => {
            void openDuplicateDialog(orderId)
          }}
          duplicateBusy={duplicateBusy}
          onDelete={orderId => void handleDeleteOrder(orderId)}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <NewOrderDialog />
        {duplicateError && (
          <div className="px-3 pt-1 text-[11px] text-neutral-500">{duplicateError}</div>
        )}
      </SidebarFooter>

      {duplicateDialogOpen && duplicateOrder && (
        <DuplicateDialog
          order={duplicateOrder}
          jobs={duplicateJobs}
          onCancel={() => setDuplicateDialogOpen(false)}
          onSuccess={newOrder => {
            setDuplicateDialogOpen(false)
            void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
            setActiveOrder(newOrder.id)
          }}
        />
      )}

    </Sidebar>
  )
}
