import { useState } from 'react'
import { Check } from 'lucide-react'
import { useUpdateJob, useSetCustomerApproval } from '../../queries/jobQueries'
import { validateJobCommonFields } from '../../lib/jobShared'
import { toDateOnly, todayDateOnly } from '../../lib/formatDate'
import {
  type DeliveryChoice,
  type OrderDetailRow,
  type Priority,
  type JobRow,
  type JobUpdate,
} from '../../types/database'
import type { FileRow } from '../../services/fileService'
import { DeadlinePicker } from '../fields/DeadlinePicker'
import { DeliverySelect } from '../fields/DeliverySelect'
import { PrioritySelect } from '../fields/PrioritySelect'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { useToast } from '../Toast'
import { GrantApprovalDialog } from './GrantApprovalDialog'

/**
 * The "Job Settings" section: the separate-value switches (deadline,
 * delivery, priority — null column = inherit from the order) and the
 * customer-approval toggle. Owns its own mutations; `onUpdated` bubbles the
 * saved row to the workspace like every other job edit.
 */
export function JobSettingsSection({
  order,
  job,
  effectiveJob,
  orderFiles,
  onOrderFilesChanged,
  onUpdated,
}: {
  order: OrderDetailRow
  job: JobRow
  effectiveJob: JobRow
  orderFiles: FileRow[]
  onOrderFilesChanged: () => void | Promise<void>
  onUpdated: (updatedJob: JobRow) => void
}) {
  const updateJob = useUpdateJob()
  const setCustomerApproval = useSetCustomerApproval()
  const { showError } = useToast()
  const [grantOpen, setGrantOpen] = useState(false)

  const handleGrantApproval = (fileId: string) => {
    setCustomerApproval.mutate(
      {
        id: job.id,
        orderId: job.order_id,
        patch: { customer_approval_granted: true, customer_approval_file_id: fileId },
        history: { event_type: 'CUSTOMER_APPROVAL_GRANTED', meta: { file_id: fileId } },
      },
      {
        onSuccess: row => {
          onUpdated(row)
          setGrantOpen(false)
        },
        onError: () => showError('Save failed'),
      },
    )
  }

  // Raw order fields drive the toggle defaults and the equality-collapse compares.
  const orderDeliveryMode = (order.delivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = order.priority
  const orderIsQuote = order.status === 'QUOTE'

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

  // Persist a field edit straight to the DB (optimistic via useUpdateJob —
  // instant UI, rollback on error). No status calculation here: status is driven
  // by the status manager (decoupled — see STATUS_WORKFLOW_SPEC.md).
  const handleUpdateJob = (patch: JobUpdate) => {
    // Every patch here is a single override field; null = back to inheriting the order's value.
    const field = Object.keys(patch)[0] as keyof JobUpdate | undefined
    updateJob.mutate(
      {
        id: job.id,
        orderId: job.order_id,
        patch,
        history: field
          ? {
              event_type: 'SETTINGS_CHANGED',
              meta: { field, previous: job[field as keyof JobRow] ?? null, next: patch[field] ?? null },
            }
          : undefined,
      },
      { onSuccess: row => onUpdated(row), onError: () => showError('Save failed') },
    )
  }

  return (
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

      <div className="col-span-2 flex items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] select-none">
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
                history: {
                  event_type: checked ? 'CUSTOMER_APPROVAL_ACTIVATED' : 'CUSTOMER_APPROVAL_DEACTIVATED',
                },
              })
            }}
          />
          <span>Customer approval required</span>
        </label>
        {job.customer_approval_required && !job.customer_approval_granted && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={isDone}
            onClick={() => setGrantOpen(true)}
          >
            Grant approval…
          </Button>
        )}
        {job.customer_approval_granted && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="size-3.5" aria-hidden />
            Granted
            {(() => {
              const approvedFile = orderFiles.find(file => file.id === job.customer_approval_file_id)
              return approvedFile ? ` — ${approvedFile.display_name}` : ''
            })()}
          </span>
        )}
      </div>

      <GrantApprovalDialog
        orderId={job.order_id}
        files={orderFiles}
        onFilesChanged={onOrderFilesChanged}
        open={grantOpen}
        onOpenChange={setGrantOpen}
        onConfirm={handleGrantApproval}
        pending={setCustomerApproval.isPending}
      />
    </div>
  )
}
