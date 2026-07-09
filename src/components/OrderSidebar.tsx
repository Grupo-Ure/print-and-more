import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orderService'
import { jobService } from '../services/jobService'
import {
  invalidateOrderListsIfCustomerReferenced,
  orderKeys,
  patchOrderStatusInCache,
  useOrdersList,
  type OrdersListFilter,
} from '../queries/orderQueries'
import {
  type Auftrag,
  type OrderStatus,
  type JobRow,
} from '../types/database'
import type { OrderListEntry } from '../services/orderService'
import { SlidersHorizontal } from 'lucide-react'
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { DuplicateDialog } from './DuplicateDialog'
import { DeleteOrderDialog } from './DeleteOrderDialog'
import { NewOrderDialog } from './NewOrderDialog'
import { useToast } from './Toast'
import { useOrderParams } from '../hooks/useOrderParams'
import { OrderSidebarSearch } from './orderSidebar/OrderSidebarSearch'
import { OrderSidebarFilters } from './orderSidebar/OrderSidebarFilters'
import { OrderSidebarBody } from './orderSidebar/OrderSidebarBody'
import { useOrderSidebarFilter } from './orderSidebar/useOrderSidebarFilter'

type OrderInPlace = { tick: number; id: string; status: OrderStatus }

type Props = {
  orderInPlace: OrderInPlace
}

export function OrderSidebar({ orderInPlace }: Props) {
  const { activeOrderId, setActiveOrder } = useOrderParams()
  const { filter, isActive: filterActive, selectedStatuses, hasStatusFilter, actions } = useOrderSidebarFilter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterPopOpen, setFilterPopOpen] = useState(false)

  const { showError } = useToast()
  const queryClient = useQueryClient()

  const ordersFilter = useMemo<OrdersListFilter>(
    () => ({
      searchDebounced: filter.searchDebounced,
      statusAll: filter.statusAll,
      selectedStatuses,
      deadlineFrom: filter.deadlineFrom,
      deadlineTo: filter.deadlineTo,
      intakeFrom: filter.intakeFrom,
      intakeTo: filter.intakeTo,
    }),
    [filter.searchDebounced, filter.statusAll, selectedStatuses, filter.deadlineFrom, filter.deadlineTo, filter.intakeFrom, filter.intakeTo],
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
  const orders = useMemo(() => {
    const rawOrders = hasStatusFilter ? ordersQuery.data ?? [] : []
    if (filter.department === 'All') return rawOrders
    return rawOrders.filter(
      order => order.jobs?.some(job => job.department === filter.department) ?? false,
    )
  }, [hasStatusFilter, ordersQuery.data, filter.department])

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
        const orderData = await orderService.getOrderById(auftragId)
        if (!orderData) throw new Error('Order not found')
        const jobData = await jobService.getJobsByOrderId(auftragId)
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
    [duplicateBusy, showError]
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<OrderListEntry | null>(null)

  const openDeleteDialog = useCallback(
    (orderId: string) => {
      const target = orders.find(order => order.id === orderId)
      if (!target) return
      if (target.status !== 'QUOTE') return
      setDeleteTarget(target)
      setDeleteDialogOpen(true)
    },
    [orders]
  )

  return (
    <Sidebar collapsible="offcanvas" side="left" className="border-r! border-gray-200">
      <SidebarHeader className="border-b border-neutral-200 px-3.5 py-2.5 bg-neutral-50">
        <div className="flex items-center justify-between gap-2 min-h-7">
          <h1 className="m-0 font-bold uppercase text-neutral-500">
            Orders
          </h1>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Filter"
              aria-label="Filter"
              aria-pressed={filterPopOpen}
              onClick={() => {
                setFilterPopOpen(o => !o)
                if (searchOpen) setSearchOpen(false)
              }}
              className={cn(
                'relative inline-flex items-center justify-center min-w-8 h-7 px-1.5 rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100',
                filterPopOpen && 'bg-neutral-200 border-neutral-300',
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              {filterActive && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-orange-600 ring-1 ring-white" />
              )}
            </button>
          </div>
        </div>

        <OrderSidebarSearch
          value={filter.searchInput}
          onChange={actions.setSearchInput}
          onClear={actions.clearSearch}
        />

        {filterPopOpen && <OrderSidebarFilters filter={filter} actions={actions} />}
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
          onDelete={orderId => openDeleteDialog(orderId)}
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

      {deleteDialogOpen && deleteTarget && (
        <DeleteOrderDialog
          order={deleteTarget}
          onCancel={() => {
            setDeleteDialogOpen(false)
            setDeleteTarget(null)
          }}
          onConfirmed={() => {
            const deletedId = deleteTarget.id
            setDeleteDialogOpen(false)
            setDeleteTarget(null)
            void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
            if (activeOrderId === deletedId) setActiveOrder(null)
          }}
        />
      )}
    </Sidebar>
  )
}
