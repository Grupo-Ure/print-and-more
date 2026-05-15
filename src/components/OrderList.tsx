import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { orderService } from '../services/orderService'
import { subOrderService } from '../services/subOrderService'
import {
  invalidateOrderListsIfCustomerReferenced,
  orderListKeys,
  patchOrderStatusInCache,
  useOrdersList,
  type OrdersListFilter,
} from '../queries/orderQueries'
import {
  type Auftrag,
  type OrderStatus,
  type SubOrderRow,
} from '../types/database'
import { DuplicateDialog } from './DuplicateDialog'
import { useToast } from './Toast'
import { OrderListSearch } from './orderList/OrderListSearch'
import { OrderListFilters } from './orderList/OrderListFilters'
import { OrderListBody } from './orderList/OrderListBody'
import {
  defaultFilterState,
  filterValidOrderStatuses,
  isFilterActive,
  statusTogglesToIn,
  type FilterState,
} from './orderList/filterState'
import './OrderList.css'

type OrderInPlace = { tick: number; id: string; status: OrderStatus }

type Props = {
  orderInPlace: OrderInPlace
  activeOrderId: string | null
  onSelectOrder: (id: string) => void
  onNewOrder: () => void
}

export function OrderList({ orderInPlace, activeOrderId, onSelectOrder, onNewOrder }: Props) {
  const [filter, setFilter] = useState<FilterState>(() => defaultFilterState())
  const { searchInput, searchDebounced, statusAll, statusToggles, deadlineFrom, deadlineTo, intakeFrom, intakeTo, department } =
    filter
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterPopOpen, setFilterPopOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilter(f => (f.searchInput === searchInput ? { ...f, searchDebounced: searchInput } : f))
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const setSearchInput = useCallback((value: string) => {
    setFilter(f => ({ ...f, searchInput: value }))
  }, [])

  const clearSearch = useCallback(() => {
    setFilter(f => ({ ...f, searchInput: '', searchDebounced: '' }))
  }, [])

  const filterActive = isFilterActive(filter)
  const { showError } = useToast()
  const queryClient = useQueryClient()

  const selectedStatuses = useMemo(
    () => filterValidOrderStatuses(statusTogglesToIn(statusToggles)),
    [statusToggles],
  )
  const hasStatusFilter = statusAll || selectedStatuses.length > 0

  const ordersFilter = useMemo<OrdersListFilter>(
    () => ({
      searchDebounced,
      statusAll,
      selectedStatuses,
      deadlineFrom,
      deadlineTo,
      intakeFrom,
      intakeTo,
    }),
    [searchDebounced, statusAll, selectedStatuses, deadlineFrom, deadlineTo, intakeFrom, intakeTo],
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
    if (department === 'All') return rawOrders
    return rawOrders.filter(
      order => order.sub_orders?.some(subOrder => subOrder.department === department) ?? false,
    )
  }, [hasStatusFilter, ordersQuery.data, department])

  const resetFilter = useCallback(() => {
    setFilter(defaultFilterState())
  }, [])

  const isEmpty = !ordersQuery.isLoading && orders.length === 0

  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicateOrder, setDuplicateOrder] = useState<Auftrag | null>(null)
  const [duplicateSubOrders, setDuplicateSubOrders] = useState<SubOrderRow[]>([])

  const openDuplicateDialog = useCallback(
    async (auftragId: string) => {
      if (duplicateBusy) return
      setDuplicateBusy(true)
      setDuplicateError(null)
      try {
        const orderData = await orderService.getOrderById(auftragId)
        if (!orderData) throw new Error('Order not found')
        const subOrderData = await subOrderService.getSubOrdersByOrderId(auftragId)
        setDuplicateOrder(orderData as Auftrag)
        setDuplicateSubOrders(subOrderData)
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

  return (
    <div className="ol-root">
      <div className="ol-head border-dashed">
        <div className="ol-head-row">
          <h1 className="ol-title">Order List</h1>
          <div className="ol-head-btns">
            <button
              type="button"
              className="ol-icon-btn"
              title="Search customer"
              aria-label="Search customer"
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen(o => !o)
                if (filterPopOpen) setFilterPopOpen(false)
              }}
            >
              🔍
            </button>
            <button
              type="button"
              className={`ol-icon-btn${filterActive ? ' ol-icon-btn--badge' : ''}`}
              title="Filter"
              aria-label="Filter"
              aria-pressed={filterPopOpen}
              onClick={() => {
                setFilterPopOpen(o => !o)
                if (searchOpen) setSearchOpen(false)
              }}
            >
              ⚙
            </button>
          </div>
        </div>

        {searchOpen && (
          <OrderListSearch
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
          />
        )}

        {filterPopOpen && (
          <OrderListFilters
            filter={filter}
            setFilter={setFilter}
            onReset={resetFilter}
          />
        )}
      </div>

      <OrderListBody
        orders={orders}
        activeOrderId={activeOrderId}
        onSelectOrder={onSelectOrder}
        isLoading={ordersQuery.isLoading}
        isFetching={ordersQuery.isFetching}
        isEmpty={isEmpty}
        onResetFilters={resetFilter}
        onDuplicate={orderId => { void openDuplicateDialog(orderId) }}
        duplicateBusy={duplicateBusy}
      />

      <div className="ol-foot">
        <button type="button" className="ol-btn-neu" onClick={onNewOrder}>
          + New Order
        </button>
      </div>

      {duplicateError && <div className="ol-aktual">{duplicateError}</div>}

      {duplicateDialogOpen && duplicateOrder && (
        <DuplicateDialog
          auftrag={duplicateOrder}
          teilauftraege={duplicateSubOrders}
          onCancel={() => setDuplicateDialogOpen(false)}
          onSuccess={newOrder => {
            setDuplicateDialogOpen(false)
            void queryClient.invalidateQueries({ queryKey: orderListKeys.all })
            onSelectOrder(newOrder.id)
          }}
        />
      )}
    </div>
  )
}
