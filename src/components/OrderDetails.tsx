import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fileService } from '../services/fileService'
import { toDateOnly } from '../lib/formatDate'
import {
  type Auftrag,
  type Customer,
  type DeliveryChoice,
  type OrderDetailRow,
  type OrderHeaderPatch,
  type Priority,
  type JobRow,
} from '../types/database'
import { useToast } from './Toast'
import type { FileRow } from '../services/fileService'
import { JobDetail } from './JobDetail'
import { JobList } from './JobList'
import { useOrderWorkspace } from '../context/order.context'
import { useOrderParams } from '../hooks/useOrderParams'
import { orderKeys, useArchiveOrder, useArchiveOrderWithCancelledJobs, useOrderById, useSetOrderStatus, useUpdateOrder } from '../queries/orderQueries'
import { jobKeys, useJobsByOrderId } from '../queries/jobQueries'
import './WorkArea.css'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_META } from '../const/orderStatus'
import { Archive, Ban, Settings } from 'lucide-react'
import { Separator } from './ui/separator'
import { DeadlinePicker } from './fields/DeadlinePicker'
import { DeliverySelect } from './fields/DeliverySelect'
import { PrioritySelect } from './fields/PrioritySelect'

type Props = {
  contextRefreshTick: number
  onActiveJobChanged: (t: JobRow | null) => void
  onOrderCustomerLoaded: (k: Customer | null) => void
  onOrderFromWorkArea: (a: Auftrag | null) => void
  onOrderFilesChanged: (d: FileRow[]) => void
}

export function OrderDetails({
  contextRefreshTick,
  onActiveJobChanged,
  onOrderCustomerLoaded,
  onOrderFromWorkArea,
  onOrderFilesChanged,
}: Props) {
  const { openCustomerDialog } = useOrderWorkspace()
  const { activeOrderId, activeJobId, setActiveJob, clearActive } = useOrderParams()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<FileRow[]>([])
  const { showError } = useToast()

  const orderQuery = useOrderById(activeOrderId)
  const jobsQuery = useJobsByOrderId(activeOrderId)
  const updateOrder = useUpdateOrder()

  const order = orderQuery.data ?? null
  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
  const loading = orderQuery.isLoading || jobsQuery.isLoading
  const isError = orderQuery.isError || jobsQuery.isError

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

  // ContextPanel still mutates jobs via services and signals through contextRefreshTick.
  // Re-sync the query caches it doesn't write to, skipping the initial mount.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!activeOrderId) return
    void queryClient.invalidateQueries({ queryKey: orderKeys.byId(activeOrderId) })
    void queryClient.invalidateQueries({ queryKey: jobKeys.byOrderId(activeOrderId) })
  }, [contextRefreshTick, activeOrderId, queryClient])

  const visibleJobs = useMemo(
    () => jobs.filter(job => !job.is_cancelled),
    [jobs]
  )
  const activeJob = useMemo((): JobRow | null => {
    if (activeJobId == null) return null
    return visibleJobs.find(job => job.id === activeJobId) ?? null
  }, [visibleJobs, activeJobId])

  // Pick a default job tab when ?sub= is unset or no longer matches a visible row.
  useEffect(() => {
    if (visibleJobs.length === 0) {
      if (activeJobId !== null) setActiveJob(null)
      return
    }
    if (activeJobId == null || !visibleJobs.some(s => s.id === activeJobId)) {
      setActiveJob(visibleJobs[0].id)
    }
  }, [visibleJobs, activeJobId, setActiveJob])

  const archiveOrder = useArchiveOrder()
  const cancelOrder = useArchiveOrderWithCancelledJobs()
  const setOrderStatus = useSetOrderStatus()

  const handleStartProcessing = async () => {
    if (!order || order.status !== 'QUOTE') return
    try {
      await setOrderStatus.mutateAsync({
        id: order.id,
        status: 'IN_PROGRESS',
        history: { event_type: 'PROCESSING_STARTED' },
      })
    } catch {
      showError('Status could not be changed')
    }
  }

  const handleMarkFinished = async () => {
    if (!order || order.status !== 'IN_PROGRESS') return
    try {
      await setOrderStatus.mutateAsync({
        id: order.id,
        status: 'FINISHED',
        history: { event_type: 'ORDER_FINISHED' },
      })
    } catch {
      showError('Status could not be changed')
    }
  }

  const handleReopenOrder = async () => {
    if (!order || order.status !== 'FINISHED') return
    try {
      await setOrderStatus.mutateAsync({
        id: order.id,
        status: 'IN_PROGRESS',
        history: { event_type: 'ORDER_REOPENED' },
      })
    } catch {
      showError('Status could not be changed')
    }
  }

  const handleArchive = async () => {
    if (!window.confirm('Archive this order? It will be hidden from the main list.')) return
    try {
      await archiveOrder.mutateAsync({ id: order!.id })
      clearActive()
    } catch {
      showError('Order could not be archived')
    }
  }

  const handleCancelOrder = async () => {
    if (!window.confirm('Cancel this order? All jobs will be cancelled and the order hidden.')) return
    try {
      await cancelOrder.mutateAsync({ id: order!.id })
      clearActive()
    } catch {
      showError('Order could not be cancelled')
    }
  }

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

  const handleJobUpdated = useCallback(
    (updatedJob: JobRow) => {
      if (activeOrderId) {
        queryClient.setQueryData<JobRow[]>(
          jobKeys.byOrderId(activeOrderId),
          old => old?.map(job => (job.id === updatedJob.id ? updatedJob : job)) ?? old,
        )
      }
      onActiveJobChanged(updatedJob)
    },
    [activeOrderId, queryClient, onActiveJobChanged]
  )

  useEffect(() => {
    if (activeOrderId == null) {
      onOrderFromWorkArea(null)
      onOrderCustomerLoaded(null)
      onActiveJobChanged(null)
      onOrderFilesChanged([])
      return
    }
    if (loading || !order || order.id !== activeOrderId) return
    onOrderFromWorkArea(order)
    onOrderCustomerLoaded(order.customers)
    onActiveJobChanged(activeJob)
    onOrderFilesChanged(files)
  }, [
    activeOrderId,
    loading,
    order,
    files,
    activeJob,
    onOrderFromWorkArea,
    onOrderCustomerLoaded,
    onActiveJobChanged,
    onOrderFilesChanged,
  ])

  if (!activeOrderId) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center">
        <h1 className='tracking-widest'>Welcome</h1>
        <h2>Select an order on the left to view details and jobs.</h2>
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
    <main className="flex flex-col gap-2 p-3 flex-1">
      <OrderHeader
        order={order}
        canMarkFinished={
          order.status === 'IN_PROGRESS' &&
          visibleJobs.length > 0 &&
          visibleJobs.every(job => job.status === 'DONE')
        }
        onEditCustomer={() =>
          openCustomerDialog(order?.customers ?? null, {
            onSaved: () => {
              if (activeOrderId) {
                void queryClient.invalidateQueries({ queryKey: orderKeys.byId(activeOrderId) })
              }
            },
          })
        }
        onArchive={() => void handleArchive()}
        onCancelOrder={() => void handleCancelOrder()}
        onStartProcessing={() => void handleStartProcessing()}
        onMarkFinished={() => void handleMarkFinished()}
        onReopenOrder={() => void handleReopenOrder()}
        archivePending={archiveOrder.isPending}
        cancelPending={cancelOrder.isPending}
        statusPending={setOrderStatus.isPending}
      />
      <Separator />

      <OrderSettings order={order} onSave={saveOrderHeader} />

      <Separator />

      <div className="flex gap-2 flex-1">
        <JobList />

        <Separator  orientation='vertical'/>

        <div className="flex-1" role="tabpanel">
          {activeJob ? (
            <JobDetail
              orderFiles={files}
              onUpdated={handleJobUpdated}
            />
          ) : (
            <p className="wa-hint">No jobs yet. Use + to add a department.</p>
          )}
        </div>
      </div>

    </main>
  )
}

type OrderHeaderProps = {
  order: OrderDetailRow
  /** True only while IN_PROGRESS with ≥1 non-cancelled job and every one of them DONE. */
  canMarkFinished: boolean
  onEditCustomer: () => void
  onArchive: () => void
  onCancelOrder: () => void
  onStartProcessing: () => void
  onMarkFinished: () => void
  onReopenOrder: () => void
  archivePending: boolean
  cancelPending: boolean
  statusPending: boolean
}

function OrderHeader({ order, canMarkFinished, onEditCustomer, onArchive, onCancelOrder, onStartProcessing, onMarkFinished, onReopenOrder, archivePending, cancelPending, statusPending }: OrderHeaderProps) {
  const customerDisplayName = order.customers?.name?.trim() || '—'
  const customerEmail = order.customers?.email?.trim() || ''
  const customerPhone = order.customers?.phone?.trim() || ''

  return (
    <header className="flex flex-col">
      <div className="flex gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <h1>Order:</h1>
          <h2 className="text-2xl!" title="Order number">
            {order.order_number}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {order.status === 'QUOTE' && (
            <Button
              type="button"
              variant="default"
              className={cn(
                'h-10 px-6 text-lg rounded-full animate-attention-ring',
                ORDER_STATUS_META.IN_PROGRESS.color,
                ORDER_STATUS_META.IN_PROGRESS.hoverColor,
              )}
              disabled={statusPending}
              onClick={onStartProcessing}
            >
              Start processing
            </Button>
          )}
          {canMarkFinished && (
            <Button
              type="button"
              variant="default"
              className={cn(
                'h-10 px-6 text-lg rounded-full',
                ORDER_STATUS_META.FINISHED.color,
                ORDER_STATUS_META.FINISHED.hoverColor,
              )}
              disabled={statusPending}
              onClick={onMarkFinished}
            >
              Mark finished
            </Button>
          )}
          {order.status === 'FINISHED' && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={statusPending}
              onClick={onReopenOrder}
            >
              Reopen order
            </Button>
          )}
          {order.status !== 'BILLED' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Archive order"
              aria-label="Archive order"
              disabled={archivePending || cancelPending}
              onClick={onArchive}
            >
              <Archive />
            </Button>
          )}
          {order.status !== 'BILLED' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Cancel order"
              aria-label="Cancel order"
              disabled={archivePending || cancelPending}
              onClick={onCancelOrder}
              className="text-destructive hover:text-destructive"
            >
              <Ban />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <h1 title="Customer" className="m-0!">
            {customerDisplayName}
          </h1>
          <Button
            onClick={onEditCustomer}
            title="Edit customer"
            aria-label="Edit customer"
            variant="ghost"
            size="icon-sm"
          >
            <Settings />
          </Button>
        </div>
        {customerEmail && <p title="Email">{customerEmail}</p>}
        {customerPhone && <p title="Phone">{customerPhone}</p>}
      </div>
    </header>
  );
}

type OrderSettingsProps = {
  order: OrderDetailRow
  onSave: (patch: OrderHeaderPatch) => void
}

function OrderSettings({ order, onSave }: OrderSettingsProps) {
  const [headerDeadline, setHeaderDeadline] = useState('')
  const [headerDelivery, setHeaderDelivery] = useState<DeliveryChoice>('PICKUP')
  const [headerPriority, setHeaderPriority] = useState<Priority>('NORMAL')
  const headerSnapshot = useRef<{
    deadline: string | null
    delivery: DeliveryChoice | null
    priority: Priority
  }>({ deadline: null, delivery: null, priority: 'NORMAL' })

  useEffect(() => {
    const rawDeadline = order.deadline
    const isoDate = toDateOnly(rawDeadline) ?? ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- form mirrors server row
    setHeaderDeadline(isoDate)
    setHeaderDelivery(order.delivery ?? 'PICKUP')
    setHeaderPriority(order.priority)
    headerSnapshot.current = {
      deadline: rawDeadline,
      delivery: order.delivery,
      priority: order.priority,
    }
  }, [order])


  return (
    <section className="flex items-center gap-4" aria-label="Order meta">
      <DeadlinePicker
        value={headerDeadline}
        onChange={value => {
          setHeaderDeadline(value ?? '')
          const snapshot = toDateOnly(headerSnapshot.current.deadline) ?? ''
          if ((value || '') !== (snapshot || '')) {
            onSave({ deadline: value })
          }
        }}
      />
      <DeliverySelect
        value={headerDelivery}
        onChange={value => {
          setHeaderDelivery(value)
          if (value !== headerSnapshot.current.delivery) {
            onSave({ delivery: value })
          }
        }}
      />
      <PrioritySelect
        value={headerPriority}
        onChange={value => {
          setHeaderPriority(value)
          if (value !== headerSnapshot.current.priority) {
            onSave({ priority: value })
          }
        }}
      />
    </section>
  )
}
