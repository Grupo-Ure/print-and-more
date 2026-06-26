import { useCancelSubOrder, useDeleteSubOrder, useEffectiveSubOrder, useSetCustomerApproval, useSetSubOrderStatus, useSubOrderById, useUpdateSubOrder } from '../queries/subOrderQueries'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import { useOrderById } from '../queries/orderQueries'
import { useStatusManager } from '../queries/useStatusManager'
import { useOrderParams } from '../hooks/useOrderParams'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { customerMeetsPrepressContact } from '../lib/customer'
import { validateSubOrderCommonFields } from '../lib/subOrderShared'
import {
  type DeliveryChoice,
  type Priority,
  type SubOrderRow,
  type SubOrderUpdate,
} from '../types/database'
import { DeadlinePicker } from './fields/DeadlinePicker'
import { DeliverySelect } from './fields/DeliverySelect'
import { PrioritySelect } from './fields/PrioritySelect'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { useToast } from './Toast'
import { CopyShopProducts } from './products/departments/CopyShopProducts'
import { LfpProducts } from './products/departments/LfpProducts'
import { StampProducts } from './products/departments/StampProducts'
import { OtherProducts } from './products/departments/OtherProducts'
import { LaserProducts } from './products/departments/LaserProducts'
import { TextileProducts } from './products/departments/TextileProducts'
import type { FileRow } from '../services/fileService'
import { toDateOnly, todayDateOnly } from '../lib/formatDate'
import { StatusBadge } from './StatusBadge'
import { SubOrderReleaseButton } from './SubOrderReleaseButton'
import { SubOrderProductionBanner } from './SubOrderProductionBanner'
import { Button } from './ui/button'
import { Ban, FileDown, Trash2 } from 'lucide-react'
import './WorkArea.css'

export function SubOrderDetail({
  orderFiles,
  onUpdated,
}: {
  orderFiles: FileRow[]
  onUpdated: (updatedSubOrder: SubOrderRow) => void
}) {
  const { activeOrderId, activeSubOrderId } = useOrderParams()
  const { data: order } = useOrderById(activeOrderId)
  const subOrder = useSubOrderById(activeOrderId, activeSubOrderId) // raw row (override/inherit state)
  const effectiveSuborder = useEffectiveSubOrder(activeOrderId, activeSubOrderId) // inherited fields resolved
  const updateSubOrder = useUpdateSubOrder()
  const setCustomerApproval = useSetCustomerApproval()
  const cancelSubOrder = useCancelSubOrder()
  const deleteSubOrder = useDeleteSubOrder()
  const markDone = useSetSubOrderStatus()
  const { showError } = useToast()

  // Status manager: auto-derives and persists the INCOMPLETE ↔ PREPRESS_READY
  // transition for the active sub-order. Single owner (one SubOrderDetail is mounted
  // at a time). Called unconditionally (before the early return) per the rules of hooks.
  useStatusManager(activeOrderId, activeSubOrderId)

  if (!order || !subOrder || !effectiveSuborder) return null

  const handleDownloadPdf = async () => {
    const ok = await generateAndDownloadPdf(subOrder.id, order.id)
    if (!ok) showError('PDF could not be generated')
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this department order?')) return
    try {
      await cancelSubOrder.mutateAsync({ id: subOrder.id, orderId: subOrder.order_id })
    } catch {
      showError('Department order could not be cancelled')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this department order?')) return
    try {
      await deleteSubOrder.mutateAsync({ id: subOrder.id, orderId: subOrder.order_id })
    } catch {
      showError('Department order could not be deleted')
    }
  }

  const handleMarkDone = async () => {
    if (!window.confirm('Mark job as done?')) return
    try {
      await markDone.mutateAsync({
        id: subOrder.id,
        orderId: subOrder.order_id,
        status: 'DONE',
        history: { event_type: 'MARKED_DONE' },
      })
    } catch {
      showError('Status could not be updated')
    }
  }

  // Persist a field edit straight to the DB (optimistic via useUpdateSubOrder —
  // instant UI, rollback on error). No status calculation here: status is driven
  // by the status manager (decoupled — see STATUS_WORKFLOW_SPEC.md).
  const handleUpdateSuborder = (patch: SubOrderUpdate) => {
    updateSubOrder.mutate(
      { id: subOrder.id, orderId: subOrder.order_id, patch },
      { onSuccess: row => onUpdated(row), onError: () => showError('Save failed') },
    )
  }

  // Raw order fields drive the toggle defaults and the equality-collapse compares.
  const orderDeliveryMode = (order.delivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = order.priority

  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(order.customers)
  const shouldValidate = subOrder.status !== 'QUOTE'

  // A field is "separate" purely when the sub-order carries its own value (the
  // column is non-null); a null column means the toggle is off and the order's
  // value is inherited. The equality-collapse — a user setting the value equal to the
  // order's clears it back to inherit — lives in each field's onChange, never here, so
  // it can't fire from a toggle or an order change.
  const hasSeparateDelivery = subOrder.delivery != null
  const hasSeparatePriority = subOrder.priority != null
  const hasSeparateDeadline = subOrder.deadline != null

  // Effective (inherited-resolved) values come from useEffectiveSubOrder.
  const effectiveDelivery = effectiveSuborder.delivery as DeliveryChoice
  const effectivePriority = effectiveSuborder.priority ?? orderPriorityMode
  const effectiveDeadline = effectiveSuborder.deadline
  const deadlineIso = toDateOnly(effectiveDeadline) ?? ''

  const validationErrors = validateSubOrderCommonFields(effectiveSuborder, subOrder.status)
  const isLocked = subOrder.status === 'PRODUCTION_READY'

  return (
    <div className="flex flex-col gap-4">
      <SubOrderProductionBanner subOrder={subOrder} />
      <div className="td-kopf" aria-label="Sub-order">
        <span className="td-bkz">[{departmentAbbreviation(subOrder.department)}]</span>
        <StatusBadge status={subOrder.status} />
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

          <Button
            type="button"
            variant="ghost"
            disabled={subOrder.status !== 'PRODUCTION_READY' || markDone.isPending}
            onClick={() => void handleMarkDone()}
            size="sm"
          >
            Mark job as done
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={subOrder.status !== 'INCOMPLETE' || deleteSubOrder.isPending}
            onClick={() => void handleDelete()}
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
            Delete job
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={subOrder.is_cancelled || subOrder.status === 'DONE' || cancelSubOrder.isPending}
            onClick={() => void handleCancel()}
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <Ban />
            Cancel job
          </Button>
        </div>

        <SubOrderReleaseButton subOrder={subOrder} orderNumber={order.order_number ?? null} />
      </div>
      {shouldValidate &&
        subOrder.department !== 'OTHER' &&
        !customerMeetsPrepressRequirements &&
        (subOrder.department === 'LFP' ||
          subOrder.department === 'COPYSHOP' ||
          (subOrder.department === 'STAMP' && subOrder.type !== 'OTHER_STAMP') ||
          (subOrder.department === 'LASER_ENGRAVING' && subOrder.type !== 'OTHER_LASER')) && (
          <p className="ber-hinweis">For auto-PREPRESS: Customer needs name and email or phone.</p>
        )}
      <section>
        <h2 className="" style={{ marginTop: 8 }}>
          Department Settings
        </h2>
        <div className="flex items-start gap-8">
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                disabled={isLocked}
                checked={hasSeparateDeadline}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateSuborder({ deadline: null })
                  } else {
                    handleUpdateSuborder({ deadline: effectiveDeadline ?? todayDateOnly() })
                  }
                }}
              />
              <span>Separate delivery date</span>
            </label>
            <DeadlinePicker
              disabled={!hasSeparateDeadline || isLocked}
              value={toDateOnly(subOrder.deadline) ?? deadlineIso}
              onChange={value => {
                if (toDateOnly(value) === toDateOnly(order.deadline)) {
                  handleUpdateSuborder({ deadline: null })
                } else if ((value ?? '') !== (toDateOnly(subOrder.deadline) ?? '')) {
                  handleUpdateSuborder({ deadline: value })
                }
              }}
            />
            {hasSeparateDeadline && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparateDelivery}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateSuborder({ delivery: null })
                  } else {
                    handleUpdateSuborder({ delivery: orderDeliveryMode })
                  }
                }}
              />
              <span>Separate delivery type</span>
            </label>
            <DeliverySelect
              disabled={!hasSeparateDelivery}
              value={effectiveDelivery}
              onChange={value => {
                if (value === orderDeliveryMode) {
                  handleUpdateSuborder({ delivery: null })
                } else if (value !== subOrder.delivery) {
                  handleUpdateSuborder({ delivery: value })
                }
              }}
            />
            {hasSeparateDelivery && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparatePriority}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateSuborder({ priority: null })
                  } else {
                    handleUpdateSuborder({ priority: orderPriorityMode })
                  }
                }}
              />
              <span>Separate priority</span>
            </label>
            <PrioritySelect
              disabled={!hasSeparatePriority}
              value={effectivePriority}
              onChange={value => {
                if (value === orderPriorityMode) {
                  handleUpdateSuborder({ priority: null })
                } else if (value !== subOrder.priority) {
                  handleUpdateSuborder({ priority: value })
                }
              }}
            />
            {hasSeparatePriority && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                disabled={isLocked}
                checked={subOrder.customer_approval_required}
                onCheckedChange={checked => {
                  setCustomerApproval.mutate({
                    id: subOrder.id,
                    orderId: subOrder.order_id,
                    patch: checked
                      ? { customer_approval_required: true }
                      : { customer_approval_required: false, customer_approval_granted: false, customer_approval_file_id: null },
                  })
                }}
              />
              <span>Customer approval required</span>
            </label>
          </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Typesetting time (min)</span>
          <div>
            <Input
              key={subOrder.id}
              type="number"
              className="max-w-48 h-9 text-sm"
              aria-invalid={shouldValidate && !!validationErrors.satzzeit_minuten}
              defaultValue={subOrder.typesetting_minutes ?? ''}
              onBlur={e => {
                const rawValue = e.target.value
                const parsedValue = rawValue === '' ? null : parseInt(rawValue, 10)
                if (parsedValue !== subOrder.typesetting_minutes) handleUpdateSuborder({ typesetting_minutes: parsedValue })
              }}
              min={1}
            />
            {shouldValidate && validationErrors.satzzeit_minuten && <p className="text-destructive text-xs mt-1">{validationErrors.satzzeit_minuten}</p>}
          </div>
        </div>
        </div>
      </section>

      <section>
        {subOrder.department === 'LFP' && (
          <LfpProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}

        {subOrder.department === 'COPYSHOP' && (
          <CopyShopProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}

        {subOrder.department === 'STAMP' && (
          <StampProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}

        {subOrder.department === 'OTHER' && (
          <OtherProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}

        {subOrder.department === 'LASER_ENGRAVING' && (
          <LaserProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}

        {subOrder.department === 'TEXTILE' && (
          <TextileProducts key={subOrder.id} subOrder={subOrder} subOrderStatus={subOrder.status} orderFiles={orderFiles} />
        )}
      </section>
    </div>
  )
}
