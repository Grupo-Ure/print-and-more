import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateSubOrder } from '../queries/subOrderQueries'
import { useProductsBySubOrderId, productKeys } from '../queries/productQueries'
import type { LoadedProduct } from '../types/product'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { customerMeetsPrepressContact } from '../lib/customer'
import {
  isSubOrderComplete,
  nextSubOrderStatus,
  validateSubOrderCommonFields,
} from '../lib/subOrderShared'
import {
  SUB_ORDER_DEPARTMENTS,
  type OrderStatus,
  type Customer,
  type DeliveryChoice,
  type Priority,
  type SubOrderDepartment,
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
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import { toDateOnly } from '../lib/formatDate'
import { StatusBadge } from './StatusBadge'
import './WorkArea.css'

export function SubOrderDetail({
  subOrder,
  orderStatus,
  orderDeadline,
  orderDelivery,
  orderPriority,
  orderCustomer,
  orderFiles,
  onUpdated,
}: {
  subOrder: SubOrderRow
  orderStatus: OrderStatus
  /** Order deadline (fallback/inheritance for sub-order) */
  orderDeadline: string | null
  /** Order delivery mode (inheritance) */
  orderDelivery: DeliveryChoice | null
  /** Order priority (inheritance) */
  orderPriority: Priority
  /** Customer contact for the active order (name, email, phone, address). */
  orderCustomer: Customer | null
  orderFiles: FileRow[]
  onUpdated: (updatedSubOrder: SubOrderRow) => void
}) {
  const queryClient = useQueryClient()
  const updateSubOrder = useUpdateSubOrder()
  const { showError } = useToast()

  const savedRef = useRef(subOrder)
  const draftRef = useRef(subOrder)

  const [draft, setDraft] = useState(subOrder)
  
  
  // Subscribe to the shared products cache (same key the department product
  // components use — no extra fetch). `save` reads the latest count imperatively
  // from this cache to drive completeness, replacing the old hasProducts ref.
  useProductsBySubOrderId(subOrder.id)

  const orderDeliveryMode = (orderDelivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = orderPriority

  useEffect(() => {
    if (subOrder.id !== draftRef.current.id) {
      // Different sub-order — always reload
      setDraft(subOrder)
      savedRef.current = subOrder
      draftRef.current = subOrder
      return
    }
    // Same sub-order: sync on status or detail change from the server; ID change handled above.
    if (subOrder.status !== draftRef.current.status || subOrder.detail !== draftRef.current.detail) {
      setDraft(prev => ({
        ...prev,
        status: subOrder.status,
        detail: subOrder.detail,
      }))
      savedRef.current = subOrder
      draftRef.current = subOrder
    }
  }, [subOrder])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const subOrderStatus = draft.status
  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(orderCustomer)
  const shouldValidate = subOrderStatus !== 'QUOTE'
  shouldValidate &&
        draft.department !== 'OTHER' &&
        !customerMeetsPrepressRequirements &&
        (draft.department === 'LFP' ||
          draft.department === 'COPYSHOP' ||
          (draft.department === 'STAMP' && draft.type !== 'OTHER_STAMP') ||
          (draft.department === 'LASER_ENGRAVING' && draft.type !== 'OTHER_LASER'))
  const hasSeparateDelivery = draft.delivery != null && draft.delivery !== orderDeliveryMode
  const hasSeparatePriority = draft.priority != null && draft.priority !== orderPriorityMode
  const effectiveDelivery = (hasSeparateDelivery ? draft.delivery! : orderDeliveryMode) as DeliveryChoice
  const effectivePriority = hasSeparatePriority ? draft.priority! : orderPriorityMode
  const validationErrors = validateSubOrderCommonFields(
    {
      ...draft,
      delivery: effectiveDelivery,
      priority: effectivePriority,
    },
    subOrderStatus
  )

  const save = useCallback(
    async (patch: Partial<SubOrderRow>) => {
      const serverSnapshot = savedRef.current
      const current = draftRef.current
      const merged: SubOrderRow = {
        ...current,
        ...patch,
        detail: patch.detail !== undefined ? patch.detail : current.detail,
        type: patch.type !== undefined ? patch.type : current.type,
      }
      const mergedWithDefaults: SubOrderRow = {
        ...merged,
        delivery: (merged.delivery ?? orderDeliveryMode) as DeliveryChoice,
        priority: merged.priority ?? orderPriorityMode,
      }
      // Read product presence fresh from the cache (kept authoritative by the
      // product save/delete mutations) — avoids a stale closure on hasProducts.
      const cachedProducts = queryClient.getQueryData<LoadedProduct[]>(productKeys.bySubOrderId(subOrder.id)) ?? []
      const isComplete = isSubOrderComplete(mergedWithDefaults, serverSnapshot.status, cachedProducts.length > 0)
      const nextStatus = nextSubOrderStatus(serverSnapshot.status, serverSnapshot, merged, isComplete, customerMeetsPrepressRequirements, orderStatus)
      const previousStatus = savedRef.current.status
      const { department: departmentPatch, ...patchWithoutDepartment } = patch
      const isValidDepartment =
        departmentPatch != null && (SUB_ORDER_DEPARTMENTS as readonly string[]).includes(departmentPatch)
      const subOrderUpdate: SubOrderUpdate = {
        ...patchWithoutDepartment,
        status: nextStatus,
        ...(isValidDepartment
          ? { department: departmentPatch as SubOrderDepartment }
          : {}),
      }
      let row: SubOrderRow
      try {
        row = await updateSubOrder.mutateAsync({ id: subOrder.id, patch: subOrderUpdate })
      } catch {
        showError('Save failed')
        return
      }
      savedRef.current = row
      draftRef.current = row
      setDraft(row)
      onUpdated(row)
      if (row.status === 'PREPRESS_READY' && previousStatus !== 'PREPRESS_READY') {
        const pdfOk = await generateAndDownloadPdf(subOrder.id, subOrder.order_id)
        if (!pdfOk) showError('PDF could not be generated')
      }
    },
    [orderDeliveryMode, orderPriorityMode, subOrder.id, subOrder.order_id, orderStatus, onUpdated, customerMeetsPrepressRequirements, showError, updateSubOrder, queryClient]
  )

  // A department component added/edited/deleted a product: recompute and persist
  // the sub-order status (the replacement for the old detail.hat_produkte write).
  // The products cache is already authoritative (patched by the product
  // save/delete mutations); save({}) recomputes status from the fresh count,
  // persists it, and fires the PREPRESS_READY PDF.
  const onProductsChanged = useCallback(
    () => {
      void save({})
    },
    [save]
  )

  const effectiveDeadline = draft.deadline ?? orderDeadline
  const deadlineIso = toDateOnly(effectiveDeadline) ?? ''

  const orderDeadlineIso = toDateOnly(orderDeadline) ?? ''

  const [separateDeadline, setSeparateDeadline] = useState(false)

  useEffect(() => {
    const tNorm = toDateOnly(subOrder.deadline)
    const aNorm = toDateOnly(orderDeadline)
    setSeparateDeadline(tNorm != null && aNorm != null && tNorm !== aNorm)
  }, [subOrder.id, subOrder.deadline, orderDeadline])

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Sub-order">
        <span className="td-bkz">[{departmentAbbreviation(draft.department)}]</span>
        <StatusBadge status={draft.status} />
        {updateSubOrder.isPending && <span aria-label="Saving">…</span>}
      </div>
      {shouldValidate &&
        draft.department !== 'OTHER' &&
        customerMeetsPrepressContact(orderCustomer) === false &&
        (draft.department === 'LFP' ||
          draft.department === 'COPYSHOP' ||
          (draft.department === 'STAMP' && draft.type !== 'OTHER_STAMP') ||
          (draft.department === 'LASER_ENGRAVING' && draft.type !== 'OTHER_LASER')) && (
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
                  if (!isChecked) {
                    const resetIso = orderDeadlineIso || ''
                    const resetDeadline = resetIso ? resetIso : null
                    setDraft(s => ({ ...s, deadline: resetDeadline }))
                    void save({ deadline: resetDeadline })
                  } else {
                    // On enable: the input should show the current value (sub-order or order).
                    const currentIso = toDateOnly(draftRef.current.deadline) ?? ''
                    if (!currentIso && orderDeadlineIso) setDraft(s => ({ ...s, deadline: orderDeadlineIso }))
                  }
                }}
              />
              <span>Separate delivery date</span>
            </label>
            <DeadlinePicker
              disabled={!separateDeadline}
              value={toDateOnly(draft.deadline) ?? deadlineIso}
              onChange={value => {
                setDraft(s => ({ ...s, deadline: value }))
                const snapshotIso = toDateOnly(savedRef.current.deadline) ?? ''
                if ((value ?? '') !== (snapshotIso ?? '')) void save({ deadline: value })
              }}
            />
            {shouldValidate && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparateDelivery}
                onCheckedChange={checked => {
                  const isChecked = checked === true
                  if (!isChecked) {
                    void save({ delivery: orderDeliveryMode })
                  } else {
                    const alternativeDelivery = orderDeliveryMode === 'PICKUP' ? 'SHIPPING' : 'PICKUP'
                    setDraft(s => ({ ...s, delivery: alternativeDelivery }))
                    void save({ delivery: alternativeDelivery })
                  }
                }}
              />
              <span>Separate delivery type</span>
            </label>
            <DeliverySelect
              disabled={!hasSeparateDelivery}
              value={effectiveDelivery}
              onChange={value => {
                setDraft(s => ({ ...s, delivery: value }))
                if (value !== savedRef.current.delivery) void save({ delivery: value })
              }}
            />
            {shouldValidate && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
          </div>
          <div className="flex flex-col min-w-0 gap-2">
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <Switch
                checked={hasSeparatePriority}
                onCheckedChange={checked => {
                  const isChecked = checked === true
                  if (!isChecked) {
                    void save({ priority: null })
                  } else {
                    const alternativePriority: Priority = orderPriorityMode === 'HIGH' ? 'NORMAL' : 'HIGH'
                    void save({ priority: alternativePriority })
                  }
                }}
              />
              <span>Separate priority</span>
            </label>
            <PrioritySelect
              disabled={!hasSeparatePriority}
              value={effectivePriority}
              onChange={value => {
                setDraft(s => ({ ...s, priority: value }))
                if (value !== savedRef.current.priority) void save({ priority: value })
              }}
            />
            {shouldValidate && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
          </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Typesetting time (min)</span>
          <div>
            <Input
              type="number"
              className="max-w-48 h-9 text-sm"
              aria-invalid={shouldValidate && !!validationErrors.satzzeit_minuten}
              value={draft.typesetting_minutes ?? ''}
              onChange={e => {
                const rawValue = e.target.value
                setDraft(s => ({
                  ...s,
                  typesetting_minutes: rawValue === '' ? null : parseInt(rawValue, 10),
                }))
              }}
              onBlur={e => {
                const rawValue = e.target.value
                const parsedValue = rawValue === '' ? null : parseInt(rawValue, 10)
                if (parsedValue !== savedRef.current.typesetting_minutes) void save({ typesetting_minutes: parsedValue })
              }}
              min={1}
            />
            {shouldValidate && validationErrors.satzzeit_minuten && <p className="text-destructive text-xs mt-1">{validationErrors.satzzeit_minuten}</p>}
          </div>
        </div>
        </div>
      </section>

      <section>
        {draft.department === 'LFP' && (
          <LfpProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}

        {draft.department === 'COPYSHOP' && (
          <CopyShopProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}

        {draft.department === 'STAMP' && (
          <StampProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}

        {draft.department === 'OTHER' && (
          <OtherProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}

        {draft.department === 'LASER_ENGRAVING' && (
          <LaserProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}

        {draft.department === 'TEXTILE' && (
          <TextileProducts key={draft.id} subOrder={draft} subOrderStatus={draft.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
        )}
      </section>
    </div>
  )
}
