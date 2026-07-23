import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fileService } from '../services/fileService'
import { toDateOnly } from '../lib/formatDate'
import { formatMinutes } from '../lib/formatMinutes'
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
import { useConfirm } from './ConfirmDialog'
import type { FileRow } from '../services/fileService'
import { JobDetail } from './JobDetail'
import { JobList } from './JobList'
import { useOrderWorkspace } from '../context/order.context'
import { useOrderParams } from '../hooks/useOrderParams'
import { orderKeys, useArchiveOrder, useArchiveOrderWithCancelledJobs, useMarkOrderBilled, useOrderById, useSetOrderStatus, useUpdateOrder } from '../queries/orderQueries'
import { jobKeys, useJobsByOrderId } from '../queries/jobQueries'
import { useTimeLogMinutesByOrderId } from '../queries/timeLogQueries'
import { useIsAdmin } from '../queries/userQueries'
import './WorkArea.css'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_META } from '../const/orderStatus'
import { Archive, Ban, CheckCircle2, Clock, Copy, History, Settings, ShieldCheck, TriangleAlert } from 'lucide-react'
import { OrderHistoryDialog } from './OrderHistoryDialog'
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
  const confirm = useConfirm()

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
  const markBilled = useMarkOrderBilled()

  const handleStartProcessing = async () => {
    if (!order || order.status !== 'QUOTE') return
    const confirmed = await confirm({
      title: 'Start processing this order?',
      description: 'The order moves to In Progress.',
      confirmLabel: 'Start processing',
    })
    if (!confirmed) return
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
    const confirmed = await confirm({
      title: 'Mark this order as finished?',
      confirmLabel: 'Mark finished',
    })
    if (!confirmed) return
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
    const confirmed = await confirm({
      title: 'Reopen this order?',
      description: 'The order goes back to In Progress.',
      confirmLabel: 'Reopen',
    })
    if (!confirmed) return
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

  const handleMarkInvoiced = async () => {
    if (!order || order.status !== 'FINISHED') return
    const confirmed = await confirm({
      title: 'Mark this order as invoiced?',
      description: 'It will be archived and hidden from the order list.',
      confirmLabel: 'Mark invoiced',
    })
    if (!confirmed) return
    try {
      await markBilled.mutateAsync({ id: order.id })
      clearActive()
    } catch {
      showError('Order could not be marked as invoiced')
    }
  }

  const handleArchive = async () => {
    const confirmed = await confirm({
      title: 'Archive this order?',
      description: 'It will be hidden from the main list.',
      confirmLabel: 'Archive',
    })
    if (!confirmed) return
    try {
      await archiveOrder.mutateAsync({ id: order!.id })
      clearActive()
    } catch {
      showError('Order could not be archived')
    }
  }

  const handleCancelOrder = async () => {
    const confirmed = await confirm({
      title: 'Cancel this order?',
      description: 'All jobs will be cancelled and the order hidden.',
      confirmLabel: 'Cancel order',
      destructive: true,
    })
    if (!confirmed) return
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
      // One field per save (the header saves on change); previous value from the loaded order.
      const field = Object.keys(patch)[0] as keyof OrderHeaderPatch | undefined
      try {
        await updateOrder.mutateAsync({
          id: activeOrderId,
          patch,
          history:
            order && field
              ? {
                  event_type: 'SETTINGS_CHANGED',
                  meta: { field, previous: order[field] ?? null, next: patch[field] ?? null },
                }
              : undefined,
        })
      } catch {
        showError('Order could not be saved')
      }
    },
    [activeOrderId, order, updateOrder, showError]
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
        <h1 className="tracking-widest">Welcome</h1>
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
    <main className="flex flex-col gap-2 p-3 flex-1 min-h-0">
      <OrderHeader
        order={order}
        hasJobs={visibleJobs.length > 0}
        allJobsDone={
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
        onMarkInvoiced={() => void handleMarkInvoiced()}
        onReopenOrder={() => void handleReopenOrder()}
        archivePending={archiveOrder.isPending}
        cancelPending={cancelOrder.isPending}
        statusPending={setOrderStatus.isPending || markBilled.isPending}
      />
      <Separator />

      <OrderSettings order={order} onSave={saveOrderHeader} />

      <Separator />

      <div className="flex gap-2 flex-1 min-h-0">
        <JobList />

        <Separator  orientation='vertical'/>

        <div className="flex-1 min-w-0 min-h-0h overflow-y-auto" role="tabpanel">
          {activeJob ? (
            <JobDetail
              orderFiles={files}
              onUpdated={handleJobUpdated}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No jobs yet. Use + to add a department.</p>
          )}
        </div>
      </div>

    </main>
  )
}

type OrderHeaderProps = {
  order: OrderDetailRow
  /** True when the order has ≥1 non-cancelled job. */
  hasJobs: boolean
  /** True when the order has ≥1 non-cancelled job and every one of them is DONE. */
  allJobsDone: boolean
  onEditCustomer: () => void
  onArchive: () => void
  onCancelOrder: () => void
  onStartProcessing: () => void
  onMarkFinished: () => void
  onMarkInvoiced: () => void
  onReopenOrder: () => void
  archivePending: boolean
  cancelPending: boolean
  statusPending: boolean
}

function OrderHeader({ order, hasJobs, allJobsDone, onEditCustomer, onArchive, onCancelOrder, onStartProcessing, onMarkFinished, onMarkInvoiced, onReopenOrder, archivePending, cancelPending, statusPending }: OrderHeaderProps) {
  const customerDisplayName = order.customers?.name?.trim() || '—'
  const customerEmail = order.customers?.email?.trim() || ''
  const customerPhone = order.customers?.phone?.trim() || ''
  const { showSuccess, showError } = useToast()
  const copyToClipboard = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        showSuccess(`${label} copied to clipboard`)
      } catch {
        showError(`${label} could not be copied`)
      }
    },
    [showSuccess, showError],
  )
  const minutesQuery = useTimeLogMinutesByOrderId(order.id)
  const totalMinutes = Object.values(minutesQuery.data ?? {}).reduce((sum, m) => sum + m, 0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { isAdmin } = useIsAdmin()

  return (
    <header className="flex flex-col">
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-between">
        <div className="flex gap-4 items-center">
          <h1>Order:</h1>
          <h2 className="text-xl desktop:text-2xl" title="Order number">
            {order.order_number}
          </h2>
          {totalMinutes > 0 && (
            <span
              className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums"
              title="Total time logged across all jobs"
            >
              <Clock size={14} />
              {formatMinutes(totalMinutes)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {order.status === 'QUOTE' && hasJobs && (
            <span className="mr-2 flex items-center gap-2 text-lg font-medium text-amber-500">
              <TriangleAlert size={16} className="shrink-0" />
              Jobs cannot move to pre-press until you start processing the order.
            </span>
          )}
          {(order.status === 'FINISHED' || order.status === 'BILLED') && (
            <span className="mr-2 flex items-center gap-2 text-lg font-medium text-green-500">
              <CheckCircle2 size={16} className="shrink-0" />
              This order is done and can no longer be modified.
            </span>
          )}
          {isAdmin && order.status === 'FINISHED' && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="text-blue-500 hover:text-blue-500"
              title="Admin-only action"
              disabled={statusPending}
              onClick={onReopenOrder}
            >
              <ShieldCheck className="shrink-0" />
              Reopen order
            </Button>
          )}
          <OrderLifecycleButton
            status={order.status}
            allJobsDone={allJobsDone}
            pending={statusPending}
            onStartProcessing={onStartProcessing}
            onMarkFinished={onMarkFinished}
            onMarkInvoiced={onMarkInvoiced}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Order history"
            aria-label="Order history"
            onClick={() => setHistoryOpen(true)}
          >
            <History />
          </Button>
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
          <h1 title="Customer">
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
        {customerEmail && (
          <div className="flex items-center gap-1">
            <p title="Email">
              <span className="font-medium">Email:</span> {customerEmail}
            </p>
            <Button
              onClick={() => copyToClipboard(customerEmail, 'Email')}
              title="Copy email"
              aria-label="Copy email"
              variant="ghost"
              size="icon-sm"
            >
              <Copy />
            </Button>
          </div>
        )}
        {customerPhone && (
          <div className="flex items-center gap-1">
            <p title="Phone">
              <span className="font-medium">Phone:</span> {customerPhone}
            </p>
            <Button
              onClick={() => copyToClipboard(customerPhone, 'Phone number')}
              title="Copy phone number"
              aria-label="Copy phone number"
              variant="ghost"
              size="icon-sm"
            >
              <Copy />
            </Button>
          </div>
        )}
      </div>
      <OrderHistoryDialog orderId={order.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </header>
  );
}

type OrderLifecycleButtonProps = {
  status: OrderDetailRow['status']
  allJobsDone: boolean
  pending: boolean
  onStartProcessing: () => void
  onMarkFinished: () => void
  onMarkInvoiced: () => void
}

/**
 * The single forward action of the order lifecycle: QUOTE → "Start processing",
 * IN_PROGRESS → "Mark finished", FINISHED → "Mark as invoiced". The latter two
 * require every non-cancelled job to be DONE; otherwise no button renders.
 */
type LifecycleAction = {
  label: string
  target: OrderDetailRow['status']
  onClick: () => void
  attention: boolean
}

function OrderLifecycleButton({ status, allJobsDone, pending, onStartProcessing, onMarkFinished, onMarkInvoiced }: OrderLifecycleButtonProps) {
  let action: LifecycleAction | null = null
  switch (status) {
    case 'QUOTE':
      action = { label: 'Start processing', target: 'IN_PROGRESS', onClick: onStartProcessing, attention: true }
      break
    case 'IN_PROGRESS':
      if (allJobsDone) {
        action = { label: 'Mark finished', target: 'FINISHED', onClick: onMarkFinished, attention: false }
      }
      break
    case 'FINISHED':
      if (allJobsDone) {
        action = { label: 'Mark as invoiced', target: 'BILLED', onClick: onMarkInvoiced, attention: false }
      }
      break
    case 'BILLED':
      break
  }

  if (!action) return null

  return (
    <Button
      type="button"
      variant="default"
      className={cn(
        'h-9 px-5 text-base desktop:h-10 desktop:px-6 desktop:text-lg rounded-full',
        action.attention && 'animate-attention-ring',
        ORDER_STATUS_META[action.target].color,
        ORDER_STATUS_META[action.target].hoverColor,
      )}
      disabled={pending}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  )
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
    <section className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Order meta">
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
