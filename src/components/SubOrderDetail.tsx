import { useEffect, useState } from 'react'
import { useUpdateSubOrder } from '../queries/subOrderQueries'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { customerMeetsPrepressContact } from '../lib/customer'
import { validateSubOrderCommonFields } from '../lib/subOrderShared'
import {
  type Customer,
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
import { toDateOnly } from '../lib/formatDate'
import { StatusBadge } from './StatusBadge'
import './WorkArea.css'

export function SubOrderDetail({
  subOrder,
  orderDeadline,
  orderDelivery,
  orderPriority,
  orderCustomer,
  orderFiles,
  onUpdated,
}: {
  subOrder: SubOrderRow
  orderDeadline: string | null
  orderDelivery: DeliveryChoice | null
  orderPriority: Priority
  orderCustomer: Customer | null
  orderFiles: FileRow[]
  onUpdated: (updatedSubOrder: SubOrderRow) => void
}) {
  const updateSubOrder = useUpdateSubOrder()
  const { showError } = useToast()

  // Persist a field edit straight to the DB (optimistic via useUpdateSubOrder —
  // instant UI, rollback on error). No status calculation here: status is driven
  // by ContextPanel (status calc is decoupled — see STATUS_WORKFLOW_SPEC.md).
  const handleUpdateSuborder = (patch: SubOrderUpdate) => {
    updateSubOrder.mutate(
      { id: subOrder.id, orderId: subOrder.order_id, patch },
      { onSuccess: row => onUpdated(row), onError: () => showError('Save failed') },
    )
  }

  const orderDeliveryMode = (orderDelivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = orderPriority

  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(orderCustomer)
  const shouldValidate = subOrder.status !== 'QUOTE'

  // A field is "separate" when the sub-order overrides the order's value; a null
  // field inherits the order value (resolved here at read time).
  const hasSeparateDelivery = subOrder.delivery != null && subOrder.delivery !== orderDeliveryMode
  const hasSeparatePriority = subOrder.priority != null && subOrder.priority !== orderPriorityMode
  const effectiveDelivery = (hasSeparateDelivery ? subOrder.delivery! : orderDeliveryMode) as DeliveryChoice
  const effectivePriority = hasSeparatePriority ? subOrder.priority! : orderPriorityMode

  const effectiveDeadline = subOrder.deadline ?? orderDeadline
  const deadlineIso = toDateOnly(effectiveDeadline) ?? ''

  const validationErrors = validateSubOrderCommonFields(
    { ...subOrder, delivery: effectiveDelivery, priority: effectivePriority },
    subOrder.status,
  )

  // The "separate deadline" toggle is user-controllable, so it's local UI state,
  // seeded from whether the sub-order's deadline differs from the order's.
  const [separateDeadline, setSeparateDeadline] = useState(false)
  useEffect(() => {
    const subOrderDate = toDateOnly(subOrder.deadline)
    const orderDate = toDateOnly(orderDeadline)
    setSeparateDeadline(subOrderDate != null && orderDate != null && subOrderDate !== orderDate)
  }, [subOrder.id, subOrder.deadline, orderDeadline])

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Sub-order">
        <span className="td-bkz">[{departmentAbbreviation(subOrder.department)}]</span>
        <StatusBadge status={subOrder.status} />
        {updateSubOrder.isPending && <span aria-label="Saving">…</span>}
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
                checked={separateDeadline}
                onCheckedChange={checked => {
                  const isChecked = checked === true
                  setSeparateDeadline(isChecked)
                  if (!isChecked) handleUpdateSuborder({ deadline: null })
                }}
              />
              <span>Separate delivery date</span>
            </label>
            <DeadlinePicker
              disabled={!separateDeadline}
              value={toDateOnly(subOrder.deadline) ?? deadlineIso}
              onChange={value => {
                const savedIso = toDateOnly(subOrder.deadline) ?? ''
                if ((value ?? '') !== savedIso) handleUpdateSuborder({ deadline: value })
              }}
            />
            {shouldValidate && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparateDelivery}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateSuborder({ delivery: null })
                  } else {
                    handleUpdateSuborder({ delivery: orderDeliveryMode === 'PICKUP' ? 'SHIPPING' : 'PICKUP' })
                  }
                }}
              />
              <span>Separate delivery type</span>
            </label>
            <DeliverySelect
              disabled={!hasSeparateDelivery}
              value={effectiveDelivery}
              onChange={value => {
                if (value !== subOrder.delivery) handleUpdateSuborder({ delivery: value })
              }}
            />
            {shouldValidate && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparatePriority}
                onCheckedChange={checked => {
                  if (checked !== true) {
                    handleUpdateSuborder({ priority: null })
                  } else {
                    handleUpdateSuborder({ priority: orderPriorityMode === 'HIGH' ? 'NORMAL' : 'HIGH' })
                  }
                }}
              />
              <span>Separate priority</span>
            </label>
            <PrioritySelect
              disabled={!hasSeparatePriority}
              value={effectivePriority}
              onChange={value => {
                if (value !== subOrder.priority) handleUpdateSuborder({ priority: value })
              }}
            />
            {shouldValidate && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
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
