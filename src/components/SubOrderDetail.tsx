import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { SUB_ORDER_COLUMNS } from '../const/subOrderSelect'
import { customerMeetsPrepressContact } from '../lib/customer'
import {
  isSubOrderComplete,
  nextSubOrderStatus,
  validateSubOrderCommonFields,
} from '../lib/subOrderShared'
import {
  SUB_ORDER_DEPARTMENTS,
  subOrderDepartmentLabel,
  type OrderStatus,
  type CustomerContactJoin,
  type DeliveryChoice,
  type Priority,
  type SubOrderRow,
} from '../types/database'
import type { Database } from '../types/supabase'
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
    ANGEBOT: { cls: 'badge-grau', label: 'ANGEBOT' },
    UNVOLLSTAENDIG: { cls: 'badge-orange', label: 'UNVOLLSTAENDIG' },
    PREPRESS_BEREIT: { cls: 'badge-blau', label: 'PREPRESS_BEREIT' },
    PRODUKTION_BEREIT: { cls: 'badge-lila', label: 'PRODUKTION_BEREIT' },
    FERTIG: { cls: 'badge-gruen', label: 'FERTIG' },
    ABGERECHNET: { cls: 'badge-grau', label: 'Abgerechnet' },
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

  const orderDeliveryMode = (orderDelivery ?? 'ABHOLUNG') as DeliveryChoice
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
  const shouldValidate = subOrderStatus !== 'ANGEBOT'
  const hasSeparateDelivery = local.lieferung != null && local.lieferung !== orderDeliveryMode
  const hasSeparatePriority = local.prioritaet !== orderPriorityMode
  const effectiveDelivery = (hasSeparateDelivery ? local.lieferung! : orderDeliveryMode) as DeliveryChoice
  const effectivePriority = hasSeparatePriority ? local.prioritaet : orderPriorityMode
  const validationErrors = validateSubOrderCommonFields(
    {
      ...local,
      lieferung: effectiveDelivery,
      prioritaet: effectivePriority,
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
        typ: patch.typ !== undefined ? patch.typ : current.typ,
      } as SubOrderRow
      const mergedWithDefaults: SubOrderRow = {
        ...merged,
        lieferung: (merged.lieferung ?? orderDeliveryMode) as DeliveryChoice,
      }
      const isComplete = isSubOrderComplete(mergedWithDefaults, serverSnapshot.status)
      const nextStatus = nextSubOrderStatus(serverSnapshot.status, serverSnapshot, merged, isComplete, customerMeetsPrepressRequirements, orderStatus)
      const previousStatus = serverSnapshotRef.current.status
      setSavePending(true)
      const { bereich: areaPatch, ...patchWithoutArea } = patch
      const isValidArea =
        areaPatch != null && (SUB_ORDER_DEPARTMENTS as readonly string[]).includes(areaPatch)
      const subOrderUpdate: Database['public']['Tables']['teilauftraege']['Update'] = {
        ...patchWithoutArea,
        status: nextStatus,
        ...(isValidArea
          ? { bereich: areaPatch as Database['public']['Enums']['teilauftrag_bereich'] }
          : {}),
      }
      const { data, error } = await supabase.from('teilauftraege').update(subOrderUpdate).eq('id', subOrder.id)
        .select(SUB_ORDER_COLUMNS)
        .single()
      setSavePending(false)
      if (error) {
        fehler('Speichern fehlgeschlagen')
        return
      }
      if (data) {
        const row = data as SubOrderRow
        serverSnapshotRef.current = row
        localRef.current = row
        setLocal(row)
        onUpdated(row)
        if (row.status === 'PREPRESS_BEREIT' && previousStatus !== 'PREPRESS_BEREIT') {
          const pdfOk = await generateAndDownloadPdf(subOrder.id, subOrder.auftrag_id)
          if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
        }
      }
    },
    [orderDeliveryMode, subOrder.id, subOrder.auftrag_id, orderStatus, onUpdated, customerMeetsPrepressRequirements, fehler]
  )

  const onLfpPatch = useCallback(
    async (patch: { typ?: string | null; detail: LfpDetail | null }) => {
      await save({
        typ: patch.typ,
        detail: (patch.detail ?? {}) as LfpDetail,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onCopyShopPatch = useCallback(
    async (patch: { typ?: string | null; detail: CopyShopDetailJson | null }) => {
      await save({
        typ: patch.typ,
        detail: (patch.detail ?? {}) as CopyShopDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onStampPatch = useCallback(
    async (patch: { typ?: string | null; detail: StampDetailJson | null }) => {
      await save({
        typ: patch.typ,
        detail: (patch.detail ?? {}) as StampDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onOtherPatch = useCallback(
    async (patch: { typ?: string | null; detail: OtherDetailJson | null }) => {
      await save({
        typ: patch.typ,
        detail: (patch.detail ?? {}) as OtherDetailJson,
      } as Partial<SubOrderRow>)
    },
    [save]
  )

  const onLaserPatch = useCallback(
    async (patch: { typ?: string | null; detail: LaserDetailJson | null }) => {
      await save({
        typ: patch.typ,
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

  const effectiveDeadline = local.termin ?? orderDeadline
  const deadlineIso = effectiveDeadline
    ? effectiveDeadline.length > 10
      ? effectiveDeadline.slice(0, 10)
      : effectiveDeadline
    : ''

  const orderDeadlineIso = orderDeadline ? (orderDeadline.length > 10 ? orderDeadline.slice(0, 10) : orderDeadline) : ''

  const [separateDeadline, setSeparateDeadline] = useState(false)

  useEffect(() => {
    const tNorm = normalizeSubOrderDeadline(subOrder.termin)
    const aNorm = normalizeSubOrderDeadline(orderDeadline)
    setSeparateDeadline(tNorm != null && aNorm != null && tNorm !== aNorm)
  }, [subOrder.id, subOrder.termin, orderDeadline])

  useEffect(() => {
    // Vererbung beim Laden: wenn Teilauftrag-Termin null und Auftrag hat Termin → im Hintergrund speichern.
    if (!subOrder.id) return
    if (serverSnapshotRef.current.termin != null) return
    if (!orderDeadlineIso) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const terminPatch: Database['public']['Tables']['teilauftraege']['Update'] = { termin: orderDeadlineIso }
          const { data, error } = await supabase
            .from('teilauftraege')
            .update(terminPatch)
            .eq('id', subOrder.id)
            .select(SUB_ORDER_COLUMNS)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as SubOrderRow
            if (!alive) return
            serverSnapshotRef.current = row
            localRef.current = row
            setLocal(row)
            onUpdated(row)
          }
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
    if (local.lieferung != null) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const lieferungPatch: Database['public']['Tables']['teilauftraege']['Update'] = {
            lieferung: orderDeliveryMode,
          }
          const { data, error } = await supabase
            .from('teilauftraege')
            .update(lieferungPatch)
            .eq('id', subOrder.id)
            .select(SUB_ORDER_COLUMNS)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as SubOrderRow
            if (!alive) return
            serverSnapshotRef.current = row
            localRef.current = row
            setLocal(row)
            onUpdated(row)
          }
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
  }, [orderDeliveryMode, local.lieferung, onUpdated, subOrder.id, fehler])

  useEffect(() => {
    if (!subOrder.id) return
    if (local.prioritaet !== 'NORMAL') return
    if (!orderPriorityMode || orderPriorityMode === 'NORMAL') return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('teilauftraege')
            .update({ prioritaet: orderPriorityMode })
            .eq('id', subOrder.id)
            .select(SUB_ORDER_COLUMNS)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as SubOrderRow
            if (!alive) return
            serverSnapshotRef.current = row
            localRef.current = row
            setLocal(row)
            onUpdated(row)
          }
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
  }, [orderPriorityMode, local.prioritaet, onUpdated, subOrder.id, fehler])

  const statusBadge = subOrderStatusBadge(local.status)

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Teilauftrag">
        <span className="td-bkz">[{departmentAbbreviation(local.bereich)}]</span>
        <span className={`badge ${statusBadge.cls}`}>
          {statusBadge.label}
          {savePending ? ' …' : ''}
        </span>
      </div>
      {shouldValidate &&
        local.bereich !== 'SONSTIGE' &&
        customerMeetsPrepressContact(orderCustomer) === false &&
        (local.bereich === 'LFP' ||
          local.bereich === 'COPYSHOP' ||
          (local.bereich === 'STEMPEL' && local.typ !== 'SONSTIGE_STEMPEL') ||
          (local.bereich === 'LASERGRAVUR' && local.typ !== 'SONSTIGE_LASER')) && (
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
                    void save({ termin: resetDeadline })
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
                  value={local.termin ? (local.termin.length > 10 ? local.termin.slice(0, 10) : local.termin) : deadlineIso}
                  onChange={e => {
                    const value = e.target.value
                    setLocal(s => ({ ...s, termin: value || null }))
                  }}
                  onBlur={e => {
                    const value = e.target.value || null
                    const snapshotIso = serverSnapshotRef.current.termin ? serverSnapshotRef.current.termin.slice(0, 10) : ''
                    if ((value ?? '') !== (snapshotIso ?? '')) {
                      void save({ termin: value })
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
                    void save({ lieferung: orderDeliveryMode })
                  } else {
                    const alternativeDelivery = orderDeliveryMode === 'ABHOLUNG' ? 'VERSAND' : 'ABHOLUNG'
                    setLocal(s => ({ ...s, lieferung: alternativeDelivery }))
                    void save({ lieferung: alternativeDelivery })
                  }
                }}
              />
              <span>Separate Lieferart</span>
            </label>
            {hasSeparateDelivery ? (
              <div style={{ marginTop: 8 }}>
                <select
                  className={'ber-inp' + fieldErrorClass('lieferung')}
                  value={local.lieferung ?? orderDeliveryMode}
                  onChange={e => {
                    const value = e.target.value as 'ABHOLUNG' | 'VERSAND'
                    setLocal(s => ({ ...s, lieferung: value }))
                  }}
                  onBlur={e => {
                    const value = (e.target.value as 'ABHOLUNG' | 'VERSAND') || orderDeliveryMode
                    if (value !== serverSnapshotRef.current.lieferung) void save({ lieferung: value })
                  }}
                >
                  <option value="ABHOLUNG">Abholung</option>
                  <option value="VERSAND">Versand</option>
                </select>
                {shouldValidate && validationErrors.lieferung && <p className="td-feld-err">{validationErrors.lieferung}</p>}
              </div>
            ) : (
              <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
                {effectiveDelivery === 'ABHOLUNG' ? 'Abholung' : 'Versand'}
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
                  void save({ prioritaet: orderPriorityMode })
                } else {
                  const alternativePriority: Priority = orderPriorityMode === 'HOCH' ? 'NORMAL' : 'HOCH'
                  void save({ prioritaet: alternativePriority })
                }
              }}
            />
            <span>Separate Priorität</span>
          </label>
          {hasSeparatePriority ? (
            <div style={{ marginTop: 8 }}>
              <select
                className={'ber-inp' + fieldErrorClass('prioritaet')}
                value={local.prioritaet}
                onChange={e => {
                  const value = e.target.value
                  if (value === 'NORMAL' || value === 'HOCH') setLocal(s => ({ ...s, prioritaet: value }))
                }}
                onBlur={e => {
                  const value = e.target.value
                  if ((value === 'NORMAL' || value === 'HOCH') && value !== serverSnapshotRef.current.prioritaet) {
                    void save({ prioritaet: value })
                  }
                }}
              >
                <option value="NORMAL">Normal</option>
                <option value="HOCH">Hoch</option>
              </select>
              {shouldValidate && validationErrors.prioritaet && <p className="td-feld-err">{validationErrors.prioritaet}</p>}
            </div>
          ) : (
            <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              {effectivePriority === 'HOCH' ? 'Hoch' : 'Normal'}
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
              if (parsedValue !== serverSnapshotRef.current.satzzeit_minuten) void save({ satzzeit_minuten: parsedValue })
            }}
            min={1}
            style={{ maxWidth: '12rem' }}
          />
          {shouldValidate && validationErrors.satzzeit_minuten && <p className="td-feld-err">{validationErrors.satzzeit_minuten}</p>}
        </div>
      </div>

      {local.bereich === 'LFP' && (
        <LFPDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onLfpPatch} orderFiles={orderFiles} />
      )}

      {local.bereich === 'COPYSHOP' && (
        <CopyShopDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onCopyShopPatch} orderFiles={orderFiles} />
      )}

      {local.bereich === 'STEMPEL' && (
        <StampDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onStampPatch} orderFiles={orderFiles} />
      )}

      {local.bereich === 'SONSTIGE' && (
        <OtherDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onOtherPatch} orderFiles={orderFiles} />
      )}

      {local.bereich === 'LASERGRAVUR' && (
        <LaserDetail subOrder={local} subOrderStatus={local.status} onDetailPatch={onLaserPatch} orderFiles={orderFiles} />
      )}

      {local.bereich === 'TEXTIL' && (
        <TextileDetail
          subOrder={local}
          subOrderStatus={local.status}
          orderStatus={orderStatus}
          orderFiles={orderFiles}
          orderCustomer={orderCustomer}
          onUpdated={onTextileSubOrderUpdated}
        />
      )}

      {local.bereich !== 'LFP' &&
        local.bereich !== 'COPYSHOP' &&
        local.bereich !== 'STEMPEL' &&
        local.bereich !== 'SONSTIGE' &&
        local.bereich !== 'LASERGRAVUR' &&
        local.bereich !== 'TEXTIL' && (
        <>
          <div className="td-zeile" style={{ marginTop: 8 }}>
            <p className="td-label">Typ</p>
            <p className="td-wert td-mono">{local.typ?.trim() ? local.typ : '—'}</p>
          </div>
          <p className="wa-hint" style={{ marginTop: 8 }}>
            Bereich {subOrderDepartmentLabel(local.bereich)}: Detailmaske folgt (analog LFP).
          </p>
        </>
      )}
    </div>
  )
}
