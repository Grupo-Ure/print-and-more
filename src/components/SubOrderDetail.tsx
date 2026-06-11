import { useCallback, useEffect, useRef, useState } from 'react'
import { subOrderService } from '../services/subOrderService'
import { subOrderProductService } from '../services/subOrderProductService'
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
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { DeadlinePicker } from './fields/DeadlinePicker'
import { DeliverySelect } from './fields/DeliverySelect'
import { PrioritySelect } from './fields/PrioritySelect'
import { Input } from './ui/input'
import { useToast } from './Toast'
import { CopyShopDetail } from './departments/CopyShopDetail'
import { LFPDetail } from './departments/LFPDetail'
import { StampDetail } from './departments/StampDetail'
import { OtherProducts } from './products/departments/OtherProducts'
import { LaserProducts } from './products/departments/LaserProducts'
import { TextileDetail } from './departments/TextileDetail'
import type { FileRow } from '../services/fileService'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import { StatusBadge } from './StatusBadge'
import './WorkArea.css'

type Props = {
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
}

/** YYYY-MM-DD für Vergleich (Lieferdatum vs. Auftrags-Deadline) */
function normalizeSubOrderDeadline(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  return trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed
}

export function SubOrderDetail({
  subOrder,
  orderStatus,
  orderDeadline,
  orderDelivery,
  orderPriority,
  orderCustomer,
  orderFiles,
  onUpdated,
}: Props) {
  const serverSnapshotRef = useRef(subOrder)
  const localRef = useRef(subOrder)
  const [local, setLocal] = useState(subOrder)
  const [savePending, setSavePending] = useState(false)
  // Whether the active sub-order has at least one product. Drives completeness
  // for the JSONB departments (replaces the old detail.hat_produkte flag).
  // A ref so `save` always reads the latest value without re-memoising.
  const hasProductsRef = useRef(false)
  const { showError } = useToast()

  const orderDeliveryMode = (orderDelivery ?? 'PICKUP') as DeliveryChoice
  const orderPriorityMode: Priority = orderPriority

  useEffect(() => {
    if (subOrder.id !== localRef.current.id) {
      // Anderer Teilaufrag — immer neu laden
      setLocal(subOrder)
      serverSnapshotRef.current = subOrder
      localRef.current = subOrder
      return
    }
    // Gleicher Teilaufrag: Sync bei Status- oder Detail-Änderung vom Server; ID-Wechsel oben.
    if (subOrder.status !== localRef.current.status || subOrder.detail !== localRef.current.detail) {
      setLocal(prev => ({
        ...prev,
        status: subOrder.status,
        detail: subOrder.detail,
      }))
      serverSnapshotRef.current = subOrder
      localRef.current = subOrder
    }
  }, [subOrder])

  useEffect(() => {
    localRef.current = local
  }, [local])

  const subOrderStatus = local.status
  const shouldValidate = subOrderStatus !== 'QUOTE'
  const hasSeparateDelivery = local.delivery != null && local.delivery !== orderDeliveryMode
  const hasSeparatePriority = local.priority !== orderPriorityMode
  const effectiveDelivery = (hasSeparateDelivery ? local.delivery! : orderDeliveryMode) as DeliveryChoice
  const effectivePriority = hasSeparatePriority ? local.priority : orderPriorityMode
  const validationErrors = validateSubOrderCommonFields(
    {
      ...local,
      delivery: effectiveDelivery,
      priority: effectivePriority,
    },
    subOrderStatus
  )
  const customerMeetsPrepressRequirements = customerMeetsPrepressContact(orderCustomer)

  const save = useCallback(
    async (patch: Partial<SubOrderRow>) => {
      const serverSnapshot = serverSnapshotRef.current
      const current = localRef.current
      const merged: SubOrderRow = {
        ...current,
        ...patch,
        detail: patch.detail !== undefined ? patch.detail : current.detail,
        type: patch.type !== undefined ? patch.type : current.type,
      } as SubOrderRow
      const mergedWithDefaults: SubOrderRow = {
        ...merged,
        delivery: (merged.delivery ?? orderDeliveryMode) as DeliveryChoice,
      }
      const isComplete = isSubOrderComplete(mergedWithDefaults, serverSnapshot.status, hasProductsRef.current)
      const nextStatus = nextSubOrderStatus(serverSnapshot.status, serverSnapshot, merged, isComplete, customerMeetsPrepressRequirements, orderStatus)
      const previousStatus = serverSnapshotRef.current.status
      setSavePending(true)
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
        row = await subOrderService.updateSubOrder(subOrder.id, subOrderUpdate)
      } catch {
        setSavePending(false)
        showError('Save failed')
        return
      }
      setSavePending(false)
      serverSnapshotRef.current = row
      localRef.current = row
      setLocal(row)
      onUpdated(row)
      if (row.status === 'PREPRESS_READY' && previousStatus !== 'PREPRESS_READY') {
        const pdfOk = await generateAndDownloadPdf(subOrder.id, subOrder.order_id)
        if (!pdfOk) showError('PDF could not be generated')
      }
    },
    [orderDeliveryMode, subOrder.id, subOrder.order_id, orderStatus, onUpdated, customerMeetsPrepressRequirements, showError]
  )

  // A department component added/edited/deleted a product: refresh the count
  // and recompute the sub-order status (the in-memory replacement for the old
  // detail.hat_produkte write). save({}) recomputes status from the fresh
  // hasProducts, persists it, and fires the PREPRESS_READY PDF.
  const onProductsChanged = useCallback(
    (hasProducts: boolean) => {
      hasProductsRef.current = hasProducts
      void save({})
    },
    [save]
  )

  const onTextileSubOrderUpdated = useCallback(
    (row: SubOrderRow) => {
      serverSnapshotRef.current = row
      localRef.current = row
      setLocal(row)
      onUpdated(row)
    },
    [onUpdated]
  )

  // Seed hasProducts when the active sub-order loads, for the JSONB departments.
  // Seeds the ref only — no status recompute on load (load reads persisted status).
  useEffect(() => {
    hasProductsRef.current = false
    const department = subOrder.department
    const isJsonbDepartment =
      department === 'LFP' ||
      department === 'COPYSHOP' ||
      department === 'STAMP' ||
      department === 'LASER_ENGRAVING' ||
      department === 'OTHER'
    if (!subOrder.id || !isJsonbDepartment) return
    let alive = true
    void (async () => {
      try {
        const rows = await subOrderProductService.getProductsBySubOrderId(subOrder.id)
        if (!alive) return
        hasProductsRef.current = rows.length > 0
      } catch {
        // Leave hasProducts as false on failure; the user can retry by editing.
      }
    })()
    return () => {
      alive = false
    }
  }, [subOrder.id, subOrder.department])

  const effectiveDeadline = local.deadline ?? orderDeadline
  const deadlineIso = effectiveDeadline
    ? effectiveDeadline.length > 10
      ? effectiveDeadline.slice(0, 10)
      : effectiveDeadline
    : ''

  const orderDeadlineIso = orderDeadline ? (orderDeadline.length > 10 ? orderDeadline.slice(0, 10) : orderDeadline) : ''

  const [separateDeadline, setSeparateDeadline] = useState(false)

  useEffect(() => {
    const tNorm = normalizeSubOrderDeadline(subOrder.deadline)
    const aNorm = normalizeSubOrderDeadline(orderDeadline)
    setSeparateDeadline(tNorm != null && aNorm != null && tNorm !== aNorm)
  }, [subOrder.id, subOrder.deadline, orderDeadline])

  useEffect(() => {
    // Vererbung beim Laden: wenn Teilauftrag-Termin null und Auftrag hat Termin → im Hintergrund speichern.
    if (!subOrder.id) return
    if (serverSnapshotRef.current.deadline != null) return
    if (!orderDeadlineIso) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const row = await subOrderService.updateSubOrder(subOrder.id, { deadline: orderDeadlineIso })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          showError('Save failed')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderDeadlineIso, onUpdated, subOrder.id, showError])

  useEffect(() => {
    if (!subOrder.id) return
    if (local.delivery != null) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const row = await subOrderService.updateSubOrder(subOrder.id, { delivery: orderDeliveryMode })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          showError('Save failed')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderDeliveryMode, local.delivery, onUpdated, subOrder.id, showError])

  useEffect(() => {
    if (!subOrder.id) return
    if (local.priority !== 'NORMAL') return
    if (!orderPriorityMode || orderPriorityMode === 'NORMAL') return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const row = await subOrderService.updateSubOrder(subOrder.id, { priority: orderPriorityMode })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          showError('Save failed')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderPriorityMode, local.priority, onUpdated, subOrder.id, showError])

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Sub-order">
        <span className="td-bkz">[{departmentAbbreviation(local.department)}]</span>
        <StatusBadge status={local.status} />
        {savePending && <span aria-label="Saving">…</span>}
      </div>
      {shouldValidate &&
        local.department !== 'OTHER' &&
        customerMeetsPrepressContact(orderCustomer) === false &&
        (local.department === 'LFP' ||
          local.department === 'COPYSHOP' ||
          (local.department === 'STAMP' && local.type !== 'OTHER_STAMP') ||
          (local.department === 'LASER_ENGRAVING' && local.type !== 'OTHER_LASER')) && (
          <p className="ber-hinweis">For auto-PREPRESS: Customer needs name and email or phone.</p>
        )}

      <h2 className="sec-h2" style={{ marginTop: 8 }}>
        General
      </h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-1.5">
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Delivery date</span>
          <div>
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <input
                type="checkbox"
                checked={separateDeadline}
                onChange={e => {
                  const isChecked = e.target.checked
                  setSeparateDeadline(isChecked)
                  if (!isChecked) {
                    const resetIso = orderDeadlineIso || ''
                    const resetDeadline = resetIso ? resetIso : null
                    setLocal(s => ({ ...s, deadline: resetDeadline }))
                    void save({ deadline: resetDeadline })
                  } else {
                    // Beim Aktivieren: Eingabefeld soll den aktuellen Wert (Teilauftrag oder Auftrag) zeigen.
                    const currentLocal = localRef.current
                    const currentIso = currentLocal.deadline
                      ? currentLocal.deadline.length > 10
                        ? currentLocal.deadline.slice(0, 10)
                        : currentLocal.deadline
                      : ''
                    if (!currentIso && orderDeadlineIso) setLocal(s => ({ ...s, deadline: orderDeadlineIso }))
                  }
                }}
              />
              <span>Separate delivery date</span>
            </label>
            {separateDeadline && (
              <div className="mt-2">
                <DeadlinePicker
                  value={local.deadline ? (local.deadline.length > 10 ? local.deadline.slice(0, 10) : local.deadline) : deadlineIso}
                  onChange={value => {
                    setLocal(s => ({ ...s, deadline: value }))
                    const snapshotIso = serverSnapshotRef.current.deadline ? serverSnapshotRef.current.deadline.slice(0, 10) : ''
                    if ((value ?? '') !== (snapshotIso ?? '')) void save({ deadline: value })
                  }}
                />
                {shouldValidate && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
              </div>
            )}
            {!separateDeadline && shouldValidate && validationErrors.termin && <p className="text-destructive text-xs mt-1">{validationErrors.termin}</p>}
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Delivery type</span>
          <div>
            <label className="flex items-center gap-2 text-[13px] select-none mt-1">
              <input
                type="checkbox"
                checked={hasSeparateDelivery}
                onChange={e => {
                  const isChecked = e.target.checked
                  if (!isChecked) {
                    void save({ delivery: orderDeliveryMode })
                  } else {
                    const alternativeDelivery = orderDeliveryMode === 'PICKUP' ? 'SHIPPING' : 'PICKUP'
                    setLocal(s => ({ ...s, delivery: alternativeDelivery }))
                    void save({ delivery: alternativeDelivery })
                  }
                }}
              />
              <span>Separate delivery type</span>
            </label>
            {hasSeparateDelivery ? (
              <div className="mt-2">
                <DeliverySelect
                  value={local.delivery ?? orderDeliveryMode}
                  onChange={value => {
                    setLocal(s => ({ ...s, delivery: value }))
                    if (value !== serverSnapshotRef.current.delivery) void save({ delivery: value })
                  }}
                />
                {shouldValidate && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground leading-snug mt-1.5 mb-0">
                {effectiveDelivery === 'PICKUP' ? 'Pickup' : 'Shipping'}
                {shouldValidate && validationErrors.lieferung && <p className="text-destructive text-xs mt-1">{validationErrors.lieferung}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col min-w-0 mt-0 max-w-88">
        <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Priority</span>
        <div>
          <label className="flex items-center gap-2 text-[13px] select-none mt-1">
            <input
              type="checkbox"
              checked={hasSeparatePriority}
              onChange={e => {
                const isChecked = e.target.checked
                if (!isChecked) {
                  void save({ priority: orderPriorityMode })
                } else {
                  const alternativePriority: Priority = orderPriorityMode === 'HIGH' ? 'NORMAL' : 'HIGH'
                  void save({ priority: alternativePriority })
                }
              }}
            />
            <span>Separate priority</span>
          </label>
          {hasSeparatePriority ? (
            <div className="mt-2">
              <PrioritySelect
                value={local.priority}
                onChange={value => {
                  setLocal(s => ({ ...s, priority: value }))
                  if (value !== serverSnapshotRef.current.priority) void save({ priority: value })
                }}
              />
              {shouldValidate && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground leading-snug mt-1.5 mb-0">
              {effectivePriority === 'HIGH' ? 'High' : 'Normal'}
              {shouldValidate && validationErrors.prioritaet && <p className="text-destructive text-xs mt-1">{validationErrors.prioritaet}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col min-w-0 mb-1.5 max-w-[16rem]">
        <span className="text-[11px] font-medium text-muted-foreground mb-0.5">Typesetting time (min)</span>
        <div>
          <Input
            type="number"
            className="max-w-48 h-9 text-sm"
            aria-invalid={shouldValidate && !!validationErrors.satzzeit_minuten}
            value={local.typesetting_minutes ?? ''}
            onChange={e => {
              const rawValue = e.target.value
              setLocal(s => ({
                ...s,
                typesetting_minutes: rawValue === '' ? null : parseInt(rawValue, 10),
              }))
            }}
            onBlur={e => {
              const rawValue = e.target.value
              const parsedValue = rawValue === '' ? null : parseInt(rawValue, 10)
              if (parsedValue !== serverSnapshotRef.current.typesetting_minutes) void save({ typesetting_minutes: parsedValue })
            }}
            min={1}
          />
          {shouldValidate && validationErrors.satzzeit_minuten && <p className="text-destructive text-xs mt-1">{validationErrors.satzzeit_minuten}</p>}
        </div>
      </div>

      {local.department === 'LFP' && (
        <LFPDetail subOrder={local} subOrderStatus={local.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
      )}

      {local.department === 'COPYSHOP' && (
        <CopyShopDetail subOrder={local} subOrderStatus={local.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
      )}

      {local.department === 'STAMP' && (
        <StampDetail subOrder={local} subOrderStatus={local.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
      )}

      {local.department === 'OTHER' && (
        <OtherProducts key={local.id} subOrder={local} subOrderStatus={local.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
      )}

      {local.department === 'LASER_ENGRAVING' && (
        <LaserProducts key={local.id} subOrder={local} subOrderStatus={local.status} orderFiles={orderFiles} onProductsChanged={onProductsChanged} />
      )}

      {local.department === 'TEXTILE' && (
        <TextileDetail
          subOrder={local}
          subOrderStatus={local.status}
          orderStatus={orderStatus}
          orderFiles={orderFiles}
          orderCustomer={orderCustomer}
          onUpdated={onTextileSubOrderUpdated}
        />
      )}

      {local.department !== 'LFP' &&
        local.department !== 'COPYSHOP' &&
        local.department !== 'STAMP' &&
        local.department !== 'OTHER' &&
        local.department !== 'LASER_ENGRAVING' &&
        local.department !== 'TEXTILE' && (
        <>
          <div className="td-zeile" style={{ marginTop: 8 }}>
            <p className="td-label">Type</p>
            <p className="td-wert td-mono">{local.type?.trim() ? local.type : '—'}</p>
          </div>
          <p className="wa-hint" style={{ marginTop: 8 }}>
            Department {subOrderDepartmentLabel(local.department)}: detail form coming soon (like LFP).
          </p>
        </>
      )}
    </div>
  )
}
