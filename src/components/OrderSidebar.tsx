import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  fetchOrderById,
  invalidateOrderListsIfCustomerReferenced,
  orderKeys,
  useDeleteOrder,
  useOrdersList,
  type OrdersListFilter,
} from '../queries/orderQueries'
import { fetchJobsByOrderId } from '../queries/jobQueries'
import { orderService } from '../services/orderService'
import {
  type Auftrag,
  type JobRow,
} from '../types/database'
import { Archive, Search } from 'lucide-react'
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TEST_IDS } from '@e2e/support/testIds'
import { DuplicateDialog } from './DuplicateDialog'
import { NewOrderDialog } from './NewOrderDialog'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
import { useOrderSelection } from '../hooks/useOrderSelection'
import { ActiveDot } from './orderSidebar/ActiveDot'
import { OrderSidebarSearch } from './orderSidebar/OrderSidebarSearch'
import {
  DeadlineFilterButton,
  DepartmentFilterButton,
  StatusFilterButton,
  UsersFilterButton,
} from './orderSidebar/OrderSidebarFilters'
import { OrderSidebarBody } from './orderSidebar/OrderSidebarBody'
import { useOrderSidebarFilter } from './orderSidebar/useOrderSidebarFilter'

export function OrderSidebar() {
  const { activeOrderId, setActiveOrder } = useOrderSelection()
  const { filter, selectedStatuses, hasStatusFilter, actions } = useOrderSidebarFilter()
  const [searchOpen, setSearchOpen] = useState(false)

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
      departments: filter.departments,
      assigneeIds: filter.assigneeIds,
      showArchived: filter.showArchived,
    }),
    [filter.searchDebounced, filter.statusAll, selectedStatuses, filter.deadlineFrom, filter.deadlineTo, filter.intakeFrom, filter.intakeTo, filter.departments, filter.assigneeIds, filter.showArchived],
  )

  const ordersQuery = useOrdersList(ordersFilter)

  useEffect(() => {
    if (ordersQuery.isError) showError('Orders could not be loaded')
  }, [ordersQuery.isError, showError])

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
    <Sidebar
      collapsible="none"
      side="left"
      data-testid={TEST_IDS.orders.sidebar.root}
      className="shrink-0 border-r! border-gray-200"
    >
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
              data-testid={TEST_IDS.orders.sidebar.searchToggle}
              aria-pressed={searchOpen}
              onClick={() => setSearchOpen(o => !o)}
              className={cn('relative desktop:hidden', searchOpen && 'bg-muted text-foreground')}
            >
              <Search className="size-3.5" />
              {searchActive && !searchOpen && <ActiveDot />}
            </Button>
            <StatusFilterButton filter={filter} actions={actions} />
            <DepartmentFilterButton filter={filter} actions={actions} />
            <DeadlineFilterButton filter={filter} actions={actions} />
            <UsersFilterButton filter={filter} actions={actions} />
            <Button
              variant="ghost"
              size="icon-sm"
              title="Show archived"
              aria-label="Show archived"
              data-testid={TEST_IDS.orders.sidebar.archivedToggle}
              aria-pressed={filter.showArchived}
              onClick={() => actions.setShowArchived(!filter.showArchived)}
              className={cn(filter.showArchived && 'bg-muted text-foreground')}
            >
              <Archive className="size-3.5" />
            </Button>
          </div>
        </div>

        <OrderSidebarSearch
          value={filter.searchInput}
          onChange={actions.setSearchInput}
          onClear={actions.clearSearch}
          open={searchOpen}
          className={cn('hidden desktop:flex', searchOpen && 'flex')}
        />
      </SidebarHeader>

      <SidebarContent className="p-0">
        <OrderSidebarBody
          orders={orders}
          activeOrderId={activeOrderId}
          onSelectOrder={setActiveOrder}
          isLoading={ordersQuery.isLoading}
          isFetching={ordersQuery.isFetching}
          isEmpty={isEmpty}
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
