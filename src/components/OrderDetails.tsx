import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fileService } from '../services/fileService'
import {
  type Auftrag,
  type Customer,
  type OrderDetailRow,
  type OrderHeaderPatch,
  type SubOrderRow,
} from '../types/database'
import { useToast } from './Toast'
import type { FileRow } from '../services/fileService'
import { SubOrderDetail } from './SubOrderDetail'
import { SubOrderTabs } from './SubOrderTabs'
import { useOrderWorkspace } from '../context/order.context'
import { orderKeys, useOrderById, useUpdateOrder } from '../queries/orderQueries'
import { subOrderKeys, useSubOrdersByOrderId } from '../queries/subOrderQueries'
import './WorkArea.css'
import { Button } from './ui/button'
import { Settings } from 'lucide-react'
import { Separator } from './ui/separator'
import { OrderSettings } from './OrderSettings'

type Props = {
  contextRefreshTick: number
  onActiveSubOrderChanged: (t: SubOrderRow | null) => void
  onOrderCustomerLoaded: (k: Customer | null) => void
  onOrderFromWorkArea: (a: Auftrag | null) => void
  onOrderFilesChanged: (d: FileRow[]) => void
}

export function OrderDetails({
  contextRefreshTick,
  onActiveSubOrderChanged,
  onOrderCustomerLoaded,
  onOrderFromWorkArea,
  onOrderFilesChanged,
}: Props) {
  const { activeOrderId, activeSubOrderId, setActiveSubOrder, openCustomerDialog } = useOrderWorkspace()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<FileRow[]>([])
  const { showError } = useToast()

  const orderQuery = useOrderById(activeOrderId)
  const subOrdersQuery = useSubOrdersByOrderId(activeOrderId)
  const updateOrder = useUpdateOrder()

  const order = orderQuery.data ?? null
  const subOrders = useMemo(() => subOrdersQuery.data ?? [], [subOrdersQuery.data])
  const loading = orderQuery.isLoading || subOrdersQuery.isLoading
  const isError = orderQuery.isError || subOrdersQuery.isError

  const reloadFiles = useCallback(async () => {
    if (!activeOrderId) return
    try {
      const data = await fileService.getFilesByOrderId(activeOrderId)
      setFiles(data)
    } catch {
      setFiles([])
      showError('Files could not be loaded')
    }
  }, [activeOrderId, showError])

  useEffect(() => {
    if (!activeOrderId) {
      setFiles([])
      return
    }
    void reloadFiles()
  }, [activeOrderId, contextRefreshTick, reloadFiles])

  useEffect(() => {
    if (isError) showError('Order could not be loaded')
  }, [isError, showError])

  // ContextPanel still mutates sub-orders via services and signals through contextRefreshTick.
  // Re-sync the query caches it doesn't write to, skipping the initial mount.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!activeOrderId) return
    void queryClient.invalidateQueries({ queryKey: orderKeys.byId(activeOrderId) })
    void queryClient.invalidateQueries({ queryKey: subOrderKeys.byOrderId(activeOrderId) })
  }, [contextRefreshTick, activeOrderId, queryClient])

  const visibleSubOrders = useMemo(
    () => subOrders.filter(subOrder => !subOrder.is_cancelled),
    [subOrders]
  )
  const activeSubOrder = useMemo((): SubOrderRow | null => {
    if (activeSubOrderId == null) return null
    return visibleSubOrders.find(subOrder => subOrder.id === activeSubOrderId) ?? null
  }, [visibleSubOrders, activeSubOrderId])

  // Pick a default sub-order tab when ?sub= is unset or no longer matches a visible row.
  useEffect(() => {
    if (visibleSubOrders.length === 0) {
      if (activeSubOrderId !== null) setActiveSubOrder(null)
      return
    }
    if (activeSubOrderId == null || !visibleSubOrders.some(s => s.id === activeSubOrderId)) {
      setActiveSubOrder(visibleSubOrders[0].id)
    }
  }, [visibleSubOrders, activeSubOrderId, setActiveSubOrder])

  const saveOrderHeader = useCallback(
    async (patch: OrderHeaderPatch) => {
      if (!activeOrderId) return
      try {
        await updateOrder.mutateAsync({ id: activeOrderId, patch })
      } catch {
        showError('Order could not be saved')
      }
    },
    [activeOrderId, updateOrder, showError]
  )

  const handleSubOrderUpdated = useCallback(
    (updatedSubOrder: SubOrderRow) => {
      if (activeOrderId) {
        queryClient.setQueryData<SubOrderRow[]>(
          subOrderKeys.byOrderId(activeOrderId),
          old => old?.map(subOrder => (subOrder.id === updatedSubOrder.id ? updatedSubOrder : subOrder)) ?? old,
        )
      }
      onActiveSubOrderChanged(updatedSubOrder)
    },
    [activeOrderId, queryClient, onActiveSubOrderChanged]
  )

  useEffect(() => {
    if (activeOrderId == null) {
      onOrderFromWorkArea(null)
      onOrderCustomerLoaded(null)
      onActiveSubOrderChanged(null)
      onOrderFilesChanged([])
      return
    }
    if (loading || !order || order.id !== activeOrderId) return
    onOrderFromWorkArea(order)
    onOrderCustomerLoaded(order.customers)
    onActiveSubOrderChanged(activeSubOrder)
    onOrderFilesChanged(files)
  }, [
    activeOrderId,
    loading,
    order,
    files,
    activeSubOrder,
    onOrderFromWorkArea,
    onOrderCustomerLoaded,
    onActiveSubOrderChanged,
    onOrderFilesChanged,
  ])

  if (!activeOrderId) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h1 className='tracking-widest'>Welcome</h1>
        <h2>Select an order on the left to view details and sub-orders.</h2>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>Loading order…</h2>
      </div>
    )
  }

  if (isError && !order) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>Order could not be loaded.</h2>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h2>Order not found.</h2>
      </div>
    )
  }

  return (
    <main className="flex flex-col gap-2 p-4">
      <OrderHeader
        order={order}
        onEditCustomer={() =>
          openCustomerDialog(order?.customers ?? null, {
            onSaved: () => {
              if (activeOrderId) {
                void queryClient.invalidateQueries({ queryKey: orderKeys.byId(activeOrderId) })
              }
            },
          })
        }
      />
      <Separator />

      <OrderSettings order={order} onSave={saveOrderHeader} />
      <Separator />

      <SubOrderTabs />
      <Separator />

      <div className="work-area__formular " role="tabpanel">
        {activeSubOrder ? (
          <SubOrderDetail
            subOrder={activeSubOrder}
            orderStatus={order.status}
            orderDeadline={order.deadline}
            orderDelivery={order.delivery}
            orderPriority={order.priority}
            orderCustomer={order.customers}
            orderFiles={files}
            onUpdated={handleSubOrderUpdated}
          />
        ) : (
          <p className="wa-hint">No sub-orders yet. Use + to add a department.</p>
        )}
      </div>
    </main>
  )
}

type OrderHeaderProps = {
  order: OrderDetailRow
  onEditCustomer: () => void
}

function OrderHeader({ order, onEditCustomer }: OrderHeaderProps) {
  const customerDisplayName = order.customers?.name?.trim() || '—'
  const customerEmail = order.customers?.email?.trim() || ''
  const customerPhone = order.customers?.phone?.trim() || ''

  return (
    <header
      className="flex flex-col"
    >
      <div className='flex items-cente gap-4'>
        <div className='flex items-center gap-1'>
          <h1 title="Customer" className='m-0!'>
            {customerDisplayName}
          </h1>
          <Button
            onClick={onEditCustomer}
            title="Edit customer"
            aria-label="Edit customer"
            variant='ghost'
            size='icon-sm'
          >
            <Settings />
          </Button>
        </div>
          <h2 title="Order number">{order.order_number}</h2>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {customerEmail && <p title="Email">{customerEmail}</p>}
        {customerPhone && <p title="Phone">{customerPhone}</p>}
      </div>
    </header>
  )
}
