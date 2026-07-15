import { useCancelJob, useDeleteJob, useEffectiveJob, useSetCustomerApproval, useSetJobAssignee, useJobById, useUpdateJob } from '../queries/jobQueries'
import { useIsAdmin, useUsers } from '../queries/userQueries'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import { useOrderById } from '../queries/orderQueries'
import { useStatusManager } from '../queries/useStatusManager'
import { useOrderParams } from '../hooks/useOrderParams'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { customerMeetsPrepressContact } from '../lib/customer'
import { validateJobCommonFields } from '../lib/jobShared'
import {
  type DeliveryChoice,
  type Priority,
  type JobRow,
  type JobUpdate,
} from '../types/database'
import { EmployeeCombobox } from './fields/EmployeeCombobox'
import { DeadlinePicker } from './fields/DeadlinePicker'
import { DeliverySelect } from './fields/DeliverySelect'
import { PrioritySelect } from './fields/PrioritySelect'
import { Switch } from './ui/switch'
import { JobTimeLogs } from './JobTimeLogs'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'
import { CopyShopProducts } from './products/departments/CopyShopProducts'
import { LfpProducts } from './products/departments/LfpProducts'
import { StampProducts } from './products/departments/StampProducts'
import { OtherProducts } from './products/departments/OtherProducts'
import { LaserProducts } from './products/departments/LaserProducts'
import { TextileProducts } from './products/departments/TextileProducts'
import type { FileRow } from '../services/fileService'
import { toDateOnly, todayDateOnly } from '../lib/formatDate'
import { StatusBadge } from './StatusBadge'
import { JOB_STATUS_META } from '../const/orderStatus'
import { JobReleaseButton } from './JobReleaseButton'
import { JobProductionBanner } from './JobProductionBanner'
import { Button } from './ui/button'
import { Ban, FileDown, Trash2 } from 'lucide-react'
import './WorkArea.css'
import { Separator } from './ui/separator'

export function JobDetail({
  orderFiles,
  onUpdated,
}: {
  orderFiles: FileRow[]
  onUpdated: (updatedJob: JobRow) => void
}) {
  const { activeOrderId, activeJobId } = useOrderParams()
  const { data: order } = useOrderById(activeOrderId)
  const job = useJobById(activeOrderId, activeJobId) // raw row (override/inherit state)
  const effectiveJob = useEffectiveJob(activeOrderId, activeJobId) // inherited fields resolved
  const updateJob = useUpdateJob()
  const setCustomerApproval = useSetCustomerApproval()
  const setJobAssignee = useSetJobAssignee()
  const cancelJob = useCancelJob()
  const deleteJob = useDeleteJob()
  const { isAdmin } = useIsAdmin()
  const { data: users = [] } = useUsers()
  const { showError } = useToast()
  const confirm = useConfirm()

  // Status manager: auto-derives and persists the IN_SETUP ↔ PREPRESS
  // transition for the active job. Single owner (one JobDetail is mounted
  // at a time). Called unconditionally (before the early return) per the rules of hooks.
  useStatusManager(activeOrderId, activeJobId)

  if (!order || !job || !effectiveJob) return null

  const handleDownloadPdf = async () => {
    const ok = await generateAndDownloadPdf(job.id, order.id)
    if (!ok) showError('PDF could not be generated')
  }

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: 'Cancel this job?',
      confirmLabel: 'Cancel job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await cancelJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be cancelled')
    }
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Permanently delete this job?',
      confirmLabel: 'Delete job',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await deleteJob.mutateAsync({ id: job.id, orderId: job.order_id })
    } catch {
      showError('Job could not be deleted')
    }
  }

  // Persist a field edit straight to the DB (optimistic via useUpdateJob —
  // instant UI, rollback on error). No status calculation here: status is driven
  // by the status manager (decoupled — see STATUS_WORKFLOW_SPEC.md).
  const handleUpdateJob = (patch: JobUpdate) => {
    updateJob.mutate(
      { id: job.id, orderId: job.order_id, patch },
      { onSuccess: row => onUpdated(row), onError: () => showError('Save failed') },
    )
  }

  // Admin-only (also enforced by a DB trigger). Writes the ASSIGNEE_CHANGED
  // history entry alongside the job update.
  const handleAssigneeChange = (assignee: { id: string; name: string } | null) => {
    if ((assignee?.id ?? null) === (job.assignee_id ?? null)) return
    const previousUser = job.assignee_id ? users.find(u => u.id === job.assignee_id) : null
    setJobAssignee.mutate(
      {
        id: job.id,
        orderId: job.order_id,
        assignee,
        previousAssignee: previousUser ? { id: previousUser.id, name: previousUser.name } : null,
      },
      { onSuccess: row => onUpdated(row), onError: () => showError('Assignee could not be changed') },
    )
  }

  // Raw order fields drive the toggle defaults and the equality-collapse compares.
  const orderDeliveryMode = (order.delivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = order.priority

  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(order.customers)
  // Nothing is required while the parent order is still a quote (order-level rule).
  const orderIsQuote = order.status === 'QUOTE'
  const shouldValidate = !orderIsQuote

  // A field is "separate" purely when the job carries its own value (the
  // column is non-null); a null column means the toggle is off and the order's
  // value is inherited. The equality-collapse — a user setting the value equal to the
  // order's clears it back to inherit — lives in each field's onChange, never here, so
  // it can't fire from a toggle or an order change.
  const hasSeparateDelivery = job.delivery != null
  const hasSeparatePriority = job.priority != null
  const hasSeparateDeadline = job.deadline != null

  // Effective (inherited-resolved) values come from useEffectiveJob.
  const effectiveDelivery = effectiveJob.delivery as DeliveryChoice
  const effectivePriority = effectiveJob.priority ?? orderPriorityMode
  const effectiveDeadline = effectiveJob.deadline
  const deadlineIso = toDateOnly(effectiveDeadline) ?? ''

  const validationErrors = validateJobCommonFields(effectiveJob, orderIsQuote)
  // In production a subset of fields is locked; once DONE everything is read-only.
  const isDone = job.status === 'DONE'
  const isLocked = job.status === 'IN_PRODUCTION' || isDone

  return (
    <div className="flex flex-col gap-4">
      <JobProductionBanner job={job} />
      <div aria-label="Job" className="flex flex-col gap-2">
        <div className="flex items-center gap-6">
          <h1 className="flex items-baseline gap-2 text-base desktop:text-lg font-bold text-gray-500">
            {jobDepartmentLabel(job.department)}
            <span>-</span>
            {job.job_number}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Assigned to</span>
            <EmployeeCombobox
              value={job.assignee_id}
              onChange={handleAssigneeChange}
              disabled={!isAdmin || isDone || setJobAssignee.isPending}
            />
          </div>
        </div>
        <div className="flex items-center">
          <StatusBadge meta={JOB_STATUS_META[job.status]} />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDownloadPdf()}
            >
              <FileDown />
              Download PDF
            </Button>

            {job.status === 'IN_SETUP' ? (
              <Button
                type="button"
                variant="ghost"
                disabled={deleteJob.isPending}
                onClick={() => void handleDelete()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Delete job
              </Button>
            ):(
              <Button
                type="button"
                variant="ghost"
                disabled={job.is_cancelled || job.status === 'IN_PRODUCTION' || job.status === 'DONE' || cancelJob.isPending}
                onClick={() => void handleCancel()}
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Ban />
                Cancel job
              </Button>
            )}
          </div>

          <JobReleaseButton job={job} orderNumber={order.order_number ?? null} />
        </div>
      </div>
      {shouldValidate &&
        job.department !== 'OTHER' &&
        !customerMeetsPrepressRequirements &&
        (job.department === 'LFP' ||
          job.department === 'COPYSHOP' ||
          (job.department === 'STAMP' && job.type !== 'OTHER_STAMP') ||
          (job.department === 'LASER_ENGRAVING' && job.type !== 'OTHER_LASER')) && (
          <p className="text-xs italic text-muted-foreground">For auto-PREPRESS: Customer needs name and email or phone.</p>
        )}
      <div className="flex gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-600">
            Job Settings
          </h2>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-[13px] select-none">
              <Switch
                disabled={isLocked}
                checked={hasSeparateDeadline}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateJob({ deadline: null })
                  } else {
                    handleUpdateJob({ deadline: effectiveDeadline ?? todayDateOnly() })
                  }
                }}
              />
              <span>Separate delivery date</span>
            </label>
            <div className="min-w-0">
              <DeadlinePicker
                disabled={!hasSeparateDeadline || isLocked}
                value={toDateOnly(job.deadline) ?? deadlineIso}
                onChange={value => {
                  if (toDateOnly(value) === toDateOnly(order.deadline)) {
                    handleUpdateJob({ deadline: null })
                  } else if ((value ?? '') !== (toDateOnly(job.deadline) ?? '')) {
                    handleUpdateJob({ deadline: value })
                  }
                }}
              />
              {hasSeparateDeadline && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
            </div>

            <label className="flex items-center gap-2 text-[13px] select-none">
              <Switch
                disabled={isDone}
                checked={hasSeparateDelivery}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateJob({ delivery: null })
                  } else {
                    handleUpdateJob({ delivery: orderDeliveryMode })
                  }
                }}
              />
              <span>Separate delivery type</span>
            </label>
            <div className="min-w-0">
              <DeliverySelect
                disabled={!hasSeparateDelivery || isDone}
                value={effectiveDelivery}
                onChange={value => {
                  if (value === orderDeliveryMode) {
                    handleUpdateJob({ delivery: null })
                  } else if (value !== job.delivery) {
                    handleUpdateJob({ delivery: value })
                  }
                }}
              />
              {hasSeparateDelivery && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
            </div>

            <label className="flex items-center gap-2 text-[13px] select-none">
              <Switch
                disabled={isDone}
                checked={hasSeparatePriority}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateJob({ priority: null })
                  } else {
                    handleUpdateJob({ priority: orderPriorityMode })
                  }
                }}
              />
              <span>Separate priority</span>
            </label>
            <div className="min-w-0">
              <PrioritySelect
                disabled={!hasSeparatePriority || isDone}
                value={effectivePriority}
                onChange={value => {
                  if (value === orderPriorityMode) {
                    handleUpdateJob({ priority: null })
                  } else if (value !== job.priority) {
                    handleUpdateJob({ priority: value })
                  }
                }}
              />
              {hasSeparatePriority && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
            </div>

            <label className="col-span-2 flex items-center gap-2 text-[13px] select-none">
              <Switch
                disabled={isLocked}
                checked={job.customer_approval_required}
                onCheckedChange={checked => {
                  setCustomerApproval.mutate({
                    id: job.id,
                    orderId: job.order_id,
                    patch: checked
                      ? { customer_approval_required: true }
                      : { customer_approval_required: false, customer_approval_granted: false, customer_approval_file_id: null },
                  })
                }}
              />
              <span>Customer approval required</span>
            </label>
          </div>
        </section>

        <Separator orientation="vertical" className="h-auto" />

        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-600">
            Employee Settings
          </h2>
          <JobTimeLogs key={job.id} orderId={order.id} jobId={job.id} disabled={isDone} />
        </section>
      </div>

      <Separator/>

      <section>
        {job.department === 'LFP' && (
          <LfpProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'COPYSHOP' && (
          <CopyShopProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'STAMP' && (
          <StampProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'OTHER' && (
          <OtherProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'LASER_ENGRAVING' && (
          <LaserProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}

        {job.department === 'TEXTILE' && (
          <TextileProducts key={job.id} job={job} jobStatus={job.status} orderFiles={orderFiles} />
        )}
      </section>
    </div>
  )
}
