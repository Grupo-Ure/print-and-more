import { useCallback, useEffect, useRef, useState } from 'react'
import { subOrderService } from '../services/subOrderService'
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
  type CustomerContactJoin,
  type DeliveryChoice,
  type Priority,
  type SubOrderDepartment,
  type SubOrderRow,
  type SubOrderUpdate,
} from '../types/database'
import { subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import { DateInput } from './DateInput'
import { useToast } from './Toast'
import { CopyShopDetail } from './departments/CopyShopDetail'
import { LFPDetail } from './departments/LFPDetail'
import { StampDetail } from './departments/StampDetail'
import { OtherDetail, type OtherDetailJson } from './departments/OtherDetail'
import { LaserDetail } from './departments/LaserDetail'
import { TextileDetail } from './departments/TextileDetail'
import type { FileRow } from '../services/fileService'
import type { LfpDetail } from '../types/lfp'
import type { CopyShopDetailJson } from '../types/copyshop'
import type { StampDetailJson } from '../types/stamp'
import type { LaserDetailJson } from '../types/laser'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
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
  /** Server join for customer contact (name, email, telefon) */
  orderCustomer: CustomerContactJoin
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

function subOrderStatusBadge(status: OrderStatus): { cls: string; label: string } {
  const statusMap: Record<OrderStatus, { cls: string; label: string }> = {
    QUOTE: { cls: 'badge-grau', label: 'ANGEBOT' },
    INCOMPLETE: { cls: 'badge-orange', label: 'UNVOLLSTAENDIG' },
    PREPRESS_READY: { cls: 'badge-blau', label: 'PREPRESS_BEREIT' },
    PRODUCTION_READY: { cls: 'badge-lila', label: 'PRODUKTION_BEREIT' },
    DONE: { cls: 'badge-gruen', label: 'FERTIG' },
    INVOICED: { cls: 'badge-grau', label: 'Abgerechnet' },
  }
  return statusMap[status] ?? { cls: 'badge-grau', label: status }
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
  const { fehler } = useToast()

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
  const fieldErrorClass = (fieldName: string) => (shouldValidate && validationErrors[fieldName] ? ' ber-inp--err' : '')

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
      const isComplete = isSubOrderComplete(mergedWithDefaults, serverSnapshot.status)
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
        fehler('Speichern fehlgeschlagen')
        return
      }
      setSavePending(false)
      serverSnapshotRef.current = row
      localRef.current = row
      setLocal(row)
      onUpdated(row)
      if (row.status === 'PREPRESS_READY' && previousStatus !== 'PREPRESS_READY') {
        const pdfOk = await generateAndDownloadPdf(subOrder.id, subOrder.order_id)
        if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
      }
    },
    [orderDeliveryMode, subOrder.id, subOrder.order_id, orderStatus, onUpdated, customerMeetsPrepressRequirements, fehler]
  )

  const onLfpPatch = useCallback(
    async (patch: { typ?: string | null; detail: LfpDetail | null }) => {
      await save({
        type: patch.typ,
        detail: (patch.detail ?? {}) as LfpDetail,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onCopyShopPatch = useCallback(
    async (patch: { typ?: string | null; detail: CopyShopDetailJson | null }) => {
      await save({
        type: patch.typ,
        detail: (patch.detail ?? {}) as CopyShopDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onStampPatch = useCallback(
    async (patch: { typ?: string | null; detail: StampDetailJson | null }) => {
      await save({
        type: patch.typ,
        detail: (patch.detail ?? {}) as StampDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onOtherPatch = useCallback(
    async (patch: { typ?: string | null; detail: OtherDetailJson | null }) => {
      await save({
        type: patch.typ,
        detail: (patch.detail ?? {}) as OtherDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onLaserPatch = useCallback(
    async (patch: { typ?: string | null; detail: LaserDetailJson | null }) => {
      await save({
        type: patch.typ,
        detail: (patch.detail ?? {}) as LaserDetailJson,
      } as Partial<SubOrderRow>)
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
          const row = await subOrderService.updateSubOrder(subOrder.id, { termin: orderDeadlineIso })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          fehler('Speichern fehlgeschlagen')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderDeadlineIso, onUpdated, subOrder.id, fehler])

  useEffect(() => {
    if (!subOrder.id) return
    if (local.delivery != null) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const row = await subOrderService.updateSubOrder(subOrder.id, { lieferung: orderDeliveryMode })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          fehler('Speichern fehlgeschlagen')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderDeliveryMode, local.delivery, onUpdated, subOrder.id, fehler])

  useEffect(() => {
    if (!subOrder.id) return
    if (local.priority !== 'NORMAL') return
    if (!orderPriorityMode || orderPriorityMode === 'NORMAL') return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const row = await subOrderService.updateSubOrder(subOrder.id, { prioritaet: orderPriorityMode })
          if (!alive) return
          serverSnapshotRef.current = row
          localRef.current = row
          setLocal(row)
          onUpdated(row)
        } catch {
          if (!alive) return
          fehler('Speichern fehlgeschlagen')
        }
      })()
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [orderPriorityMode, local.priority, onUpdated, subOrder.id, fehler])

  const statusBadge = subOrderStatusBadge(local.status)

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Teilauftrag">
        <span className="td-bkz">[{departmentAbbreviation(local.department)}]</span>
        <span className={`badge ${statusBadge.cls}`}>
          {statusBadge.label}
          {savePending ? ' …' : ''}
        </span>
      </div>
      {shouldValidate &&
        local.department !== 'OTHER' &&
        customerMeetsPrepressContact(orderCustomer) === false &&
        (local.department === 'LFP' ||
          local.department === 'COPYSHOP' ||
          (local.department === 'STAMP' && local.type !== 'SONSTIGE_STEMPEL') ||
          (local.department === 'LASER_ENGRAVING' && local.type !== 'SONSTIGE_LASER')) && (
          <p className="ber-hinweis">Für Auto-PREPRESS: Kunde braucht Name und E-Mail oder Telefon.</p>
        )}

      <h2 className="sec-h2" style={{ marginTop: 8 }}>
        Allgemein
      </h2>
      <div className="ber-grid-2">
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Lieferdatum</span>
          <div>
            <label className="cp-toggle" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={separateDeadline}
                onChange={e => {
                  const isChecked = e.target.checked
                  setSeparateDeadline(isChecked)
                  if (!isChecked) {
                    const resetIso = orderDeadlineIso || ''
                    const resetDeadline = resetIso ? resetIso : null
                    setLocal(s => ({ ...s, termin: resetDeadline }))
                    void save({ deadline: resetDeadline })
                  } else {
                    // Beim Aktivieren: Eingabefeld soll den aktuellen Wert (Teilauftrag oder Auftrag) zeigen.
                    const currentLocal = localRef.current
                    const currentIso = currentLocal.termin
                      ? currentLocal.termin.length > 10
                        ? currentLocal.termin.slice(0, 10)
                        : currentLocal.termin
                      : ''
                    if (!currentIso && orderDeadlineIso) setLocal(s => ({ ...s, termin: orderDeadlineIso }))
                  }
                }}
              />
              <span>Separates Lieferdatum</span>
            </label>
            {separateDeadline && (
              <div style={{ marginTop: 8 }}>
                <DateInput
                  className={'ber-inp' + fieldErrorClass('termin')}
                  value={local.deadline ? (local.deadline.length > 10 ? local.deadline.slice(0, 10) : local.deadline) : deadlineIso}
                  onChange={e => {
                    const value = e.target.value
                    setLocal(s => ({ ...s, termin: value || null }))
                  }}
                  onBlur={e => {
                    const value = e.target.value || null
                    const snapshotIso = serverSnapshotRef.current.deadline ? serverSnapshotRef.current.deadline.slice(0, 10) : ''
                    if ((value ?? '') !== (snapshotIso ?? '')) {
                      void save({ deadline: value })
                    }
                  }}
                />
                {shouldValidate && validationErrors.termin && <p className="td-feld-err">{validationErrors.termin}</p>}
              </div>
            )}
            {!separateDeadline && shouldValidate && validationErrors.termin && <p className="td-feld-err">{validationErrors.termin}</p>}
          </div>
        </div>
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Lieferart</span>
          <div>
            <label className="cp-toggle" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={hasSeparateDelivery}
                onChange={e => {
                  const isChecked = e.target.checked
                  if (!isChecked) {
                    void save({ delivery: orderDeliveryMode })
                  } else {
                    const alternativeDelivery = orderDeliveryMode === 'PICKUP' ? 'SHIPPING' : 'PICKUP'
                    setLocal(s => ({ ...s, lieferung: alternativeDelivery }))
                    void save({ delivery: alternativeDelivery })
                  }
                }}
              />
              <span>Separate Lieferart</span>
            </label>
            {hasSeparateDelivery ? (
              <div style={{ marginTop: 8 }}>
                <select
                  className={'ber-inp' + fieldErrorClass('lieferung')}
                  value={local.delivery ?? orderDeliveryMode}
                  onChange={e => {
                    const value = e.target.value as 'PICKUP' | 'SHIPPING'
                    setLocal(s => ({ ...s, lieferung: value }))
                  }}
                  onBlur={e => {
                    const value = (e.target.value as 'PICKUP' | 'SHIPPING') || orderDeliveryMode
                    if (value !== serverSnapshotRef.current.delivery) void save({ delivery: value })
                  }}
                >
                  <option value="PICKUP">Abholung</option>
                  <option value="SHIPPING">Versand</option>
                </select>
                {shouldValidate && validationErrors.lieferung && <p className="td-feld-err">{validationErrors.lieferung}</p>}
              </div>
            ) : (
              <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
                {effectiveDelivery === 'PICKUP' ? 'Abholung' : 'Versand'}
                {shouldValidate && validationErrors.lieferung && <p className="td-feld-err">{validationErrors.lieferung}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ber-zeile-stack" style={{ marginTop: 0, maxWidth: '22rem' }}>
        <span className="ber-lbl">Priorität</span>
        <div>
          <label className="cp-toggle" style={{ marginTop: 4 }}>
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
            <span>Separate Priorität</span>
          </label>
          {hasSeparatePriority ? (
            <div style={{ marginTop: 8 }}>
              <select
                className={'ber-inp' + fieldErrorClass('prioritaet')}
                value={local.priority}
                onChange={e => {
                  const value = e.target.value
                  if (value === 'NORMAL' || value === 'HIGH') setLocal(s => ({ ...s, prioritaet: value }))
                }}
                onBlur={e => {
                  const value = e.target.value
                  if ((value === 'NORMAL' || value === 'HIGH') && value !== serverSnapshotRef.current.priority) {
                    void save({ priority: value })
                  }
                }}
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Hoch</option>
              </select>
              {shouldValidate && validationErrors.prioritaet && <p className="td-feld-err">{validationErrors.prioritaet}</p>}
            </div>
          ) : (
            <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              {effectivePriority === 'HIGH' ? 'Hoch' : 'Normal'}
              {shouldValidate && validationErrors.prioritaet && <p className="td-feld-err">{validationErrors.prioritaet}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="ber-zeile-stack" style={{ marginBottom: 6, maxWidth: '16rem' }}>
        <span className="ber-lbl">Satzzeit (min)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fieldErrorClass('satzzeit_minuten')}
            value={local.satzzeit_minuten ?? ''}
            onChange={e => {
              const rawValue = e.target.value
              setLocal(s => ({
                ...s,
                satzzeit_minuten: rawValue === '' ? null : parseInt(rawValue, 10),
              }))
            }}
            onBlur={e => {
              const rawValue = e.target.value
              const parsedValue = rawValue === '' ? null : parseInt(rawValue, 10)
              if (parsedValue !== serverSnapshotRef.current.typesetting_minutes) void save({ typesetting_minutes: parsedValue })
            }}
            min={1}
            style={{ maxWidth: '12rem' }}
          />
          {shouldValidate && validationErrors.satzzeit_minuten && <p className="td-feld-err">{validationErrors.satzzeit_minuten}</p>}
        </div>
      </div>

      {local.department === 'LFP' && (
        <LFPDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onLfpPatch} orderFiles={orderFiles} />
      )}

      {local.department === 'COPYSHOP' && (
        <CopyShopDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onCopyShopPatch} orderFiles={orderFiles} />
      )}

      {local.department === 'STAMP' && (
        <StampDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onStampPatch} orderFiles={orderFiles} />
      )}

      {local.department === 'OTHER' && (
        <OtherDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onOtherPatch} orderFiles={orderFiles} />
      )}

      {local.department === 'LASER_ENGRAVING' && (
        <LaserDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onLaserPatch} orderFiles={orderFiles} />
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
            <p className="td-label">Typ</p>
            <p className="td-wert td-mono">{local.type?.trim() ? local.type : '—'}</p>
          </div>
          <p className="wa-hint" style={{ marginTop: 8 }}>
            Bereich {subOrderDepartmentLabel(local.department)}: Detailmaske folgt (analog LFP).
          </p>
        </>
      )}
    </div>
  )
}
