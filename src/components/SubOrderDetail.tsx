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
  TEILAUFTRAG_BEREICHE,
  teilauftragBereichLabel,
  type AuftragStatus,
  type KundeKontaktJoin,
  type LieferungWahl,
  type Prioritaet,
  type TeilauftragRow,
} from '../types/database'
import type { Database } from '../types/supabase'
import { DateInput } from './DateInput'
import { useToast } from './Toast'
import { CopyShopDetail } from './bereiche/CopyShopDetail'
import { LFPDetail } from './bereiche/LFPDetail'
import { StampDetail } from './bereiche/StampDetail'
import { OtherDetail, type OtherDetailJson } from './bereiche/OtherDetail'
import { LaserDetail } from './bereiche/LaserDetail'
import { TextileDetail } from './bereiche/TextileDetail'
import type { FileRecord } from './FileList'
import type { LfpDetail } from '../types/lfp'
import type { CopyShopDetailJson } from '../types/copyshop'
import type { StampDetailJson } from '../types/stamp'
import type { LaserDetailJson } from '../types/laser'
import { generateAndDownloadPdf } from '../lib/pdf/orderPdf'
import './WorkArea.css'

type Props = {
  subOrder: TeilauftragRow
  orderStatus: AuftragStatus
  /** Order deadline (fallback/inheritance for sub-order) */
  orderDeadline: string | null
  /** Order delivery mode (inheritance) */
  orderDelivery: LieferungWahl | null
  /** Order priority (inheritance) */
  orderPriority: Prioritaet
  /** Server join for customer contact (name, email, telefon) */
  orderCustomer: KundeKontaktJoin
  orderFiles: FileRecord[]
  onUpdated: (t: TeilauftragRow) => void
}

/** YYYY-MM-DD für Vergleich (Lieferdatum vs. Auftrags-Deadline) */
function normTeilTermin(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  if (t === '') return null
  return t.length > 10 ? t.slice(0, 10) : t
}

function teilStatusBadgeAuf(s: AuftragStatus): { cls: string; label: string } {
  const m: Record<AuftragStatus, { cls: string; label: string }> = {
    ANGEBOT: { cls: 'badge-grau', label: 'ANGEBOT' },
    UNVOLLSTAENDIG: { cls: 'badge-orange', label: 'UNVOLLSTAENDIG' },
    PREPRESS_BEREIT: { cls: 'badge-blau', label: 'PREPRESS_BEREIT' },
    PRODUKTION_BEREIT: { cls: 'badge-lila', label: 'PRODUKTION_BEREIT' },
    FERTIG: { cls: 'badge-gruen', label: 'FERTIG' },
    ABGERECHNET: { cls: 'badge-grau', label: 'Abgerechnet' },
  }
  return m[s] ?? { cls: 'badge-grau', label: s }
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
  const snapR = useRef(subOrder)
  const lokalR = useRef(subOrder)
  const [lokal, setLokal] = useState(subOrder)
  const [speichLad, setSpeichLad] = useState(false)
  const { fehler } = useToast()

  const auftragLief = (orderDelivery ?? 'ABHOLUNG') as LieferungWahl
  const auftragPrio: Prioritaet = orderPriority

  useEffect(() => {
    if (subOrder.id !== lokalR.current.id) {
      // Anderer Teilaufrag — immer neu laden
      setLokal(subOrder)
      snapR.current = subOrder
      lokalR.current = subOrder
      return
    }
    // Gleicher Teilaufrag: Sync bei Status- oder Detail-Änderung vom Server; ID-Wechsel oben.
    if (subOrder.status !== lokalR.current.status || subOrder.detail !== lokalR.current.detail) {
      setLokal(prev => ({
        ...prev,
        status: subOrder.status,
        detail: subOrder.detail,
      }))
      snapR.current = subOrder
      lokalR.current = subOrder
    }
  }, [subOrder])

  useEffect(() => {
    lokalR.current = lokal
  }, [lokal])

  const tStatus = lokal.status
  const pruef = tStatus !== 'ANGEBOT'
  const separateLieferung = lokal.lieferung != null && lokal.lieferung !== auftragLief
  const separatePrioritaet = lokal.prioritaet !== auftragPrio
  const effLieferung = (separateLieferung ? lokal.lieferung! : auftragLief) as LieferungWahl
  const effPrioritaet = separatePrioritaet ? lokal.prioritaet : auftragPrio
  const gErr = validateSubOrderCommonFields(
    {
      ...lokal,
      lieferung: effLieferung,
      prioritaet: effPrioritaet,
    },
    tStatus
  )
  const gFe = (k: string) => (pruef && gErr[k] ? ' ber-inp--err' : '')

  const kundePre = customerMeetsPrepressContact(orderCustomer)

  const speichere = useCallback(
    async (patch: Partial<TeilauftragRow>) => {
      const snap = snapR.current
      const cur = lokalR.current
      const merged: TeilauftragRow = {
        ...cur,
        ...patch,
        detail: patch.detail !== undefined ? patch.detail : cur.detail,
        typ: patch.typ !== undefined ? patch.typ : cur.typ,
      } as TeilauftragRow
      const mergedNorm: TeilauftragRow = {
        ...merged,
        lieferung: (merged.lieferung ?? auftragLief) as LieferungWahl,
      }
      const voll = isSubOrderComplete(mergedNorm, snap.status)
      const nSt = nextSubOrderStatus(snap.status, snap, merged, voll, kundePre, orderStatus)
      const statusVorher = snapR.current.status
      setSpeichLad(true)
      const { bereich: bereichPatch, ...patchOhneBereich } = patch
      const bereichGueltig =
        bereichPatch != null && (TEILAUFTRAG_BEREICHE as readonly string[]).includes(bereichPatch)
      const teilUpdate: Database['public']['Tables']['teilauftraege']['Update'] = {
        ...patchOhneBereich,
        status: nSt,
        ...(bereichGueltig
          ? { bereich: bereichPatch as Database['public']['Enums']['teilauftrag_bereich'] }
          : {}),
      }
      const { data, error } = await supabase.from('teilauftraege').update(teilUpdate).eq('id', subOrder.id)
        .select(SUB_ORDER_COLUMNS)
        .single()
      setSpeichLad(false)
      if (error) {
        fehler('Speichern fehlgeschlagen')
        return
      }
      if (data) {
        const row = data as TeilauftragRow
        snapR.current = row
        lokalR.current = row
        setLokal(row)
        onUpdated(row)
        if (row.status === 'PREPRESS_BEREIT' && statusVorher !== 'PREPRESS_BEREIT') {
          const pdfOk = await generateAndDownloadPdf(subOrder.id, subOrder.auftrag_id)
          if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
        }
      }
    },
    [auftragLief, subOrder.id, subOrder.auftrag_id, orderStatus, onUpdated, kundePre, fehler]
  )

  const onLfpPatch = useCallback(
    async (p: { typ?: string | null; detail: LfpDetail | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as LfpDetail,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onCopyShopPatch = useCallback(
    async (p: { typ?: string | null; detail: CopyShopDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as CopyShopDetailJson,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onStempelPatch = useCallback(
    async (p: { typ?: string | null; detail: StampDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as StampDetailJson,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onSonstigePatch = useCallback(
    async (p: { typ?: string | null; detail: OtherDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as OtherDetailJson,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onLaserPatch = useCallback(
    async (p: { typ?: string | null; detail: LaserDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as LaserDetailJson,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onTextilTeilAktualisiert = useCallback(
    (row: TeilauftragRow) => {
      snapR.current = row
      lokalR.current = row
      setLokal(row)
      onUpdated(row)
    },
    [onUpdated]
  )

  const globTermin = lokal.termin ?? orderDeadline
  const iso = globTermin
    ? globTermin.length > 10
      ? globTermin.slice(0, 10)
      : globTermin
    : ''

  const auftragIso = orderDeadline ? (orderDeadline.length > 10 ? orderDeadline.slice(0, 10) : orderDeadline) : ''

  const [sepTermin, setSepTermin] = useState(false)

  useEffect(() => {
    const tNorm = normTeilTermin(subOrder.termin)
    const aNorm = normTeilTermin(orderDeadline)
    setSepTermin(tNorm != null && aNorm != null && tNorm !== aNorm)
  }, [subOrder.id, subOrder.termin, orderDeadline])

  useEffect(() => {
    // Vererbung beim Laden: wenn Teilauftrag-Termin null und Auftrag hat Termin → im Hintergrund speichern.
    if (!subOrder.id) return
    if (snapR.current.termin != null) return
    if (!auftragIso) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const terminPatch: Database['public']['Tables']['teilauftraege']['Update'] = { termin: auftragIso }
          const { data, error } = await supabase
            .from('teilauftraege')
            .update(terminPatch)
            .eq('id', subOrder.id)
            .select(SUB_ORDER_COLUMNS)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
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
  }, [auftragIso, onUpdated, subOrder.id, fehler])

  useEffect(() => {
    if (!subOrder.id) return
    if (lokal.lieferung != null) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const lieferungPatch: Database['public']['Tables']['teilauftraege']['Update'] = {
            lieferung: auftragLief,
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
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
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
  }, [auftragLief, lokal.lieferung, onUpdated, subOrder.id, fehler])

  useEffect(() => {
    if (!subOrder.id) return
    if (lokal.prioritaet !== 'NORMAL') return
    if (!auftragPrio || auftragPrio === 'NORMAL') return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('teilauftraege')
            .update({ prioritaet: auftragPrio })
            .eq('id', subOrder.id)
            .select(SUB_ORDER_COLUMNS)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
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
  }, [auftragPrio, lokal.prioritaet, onUpdated, subOrder.id, fehler])

  const tBadge = teilStatusBadgeAuf(lokal.status)

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Teilauftrag">
        <span className="td-bkz">[{departmentAbbreviation(lokal.bereich)}]</span>
        <span className={`badge ${tBadge.cls}`}>
          {tBadge.label}
          {speichLad ? ' …' : ''}
        </span>
      </div>
      {pruef &&
        lokal.bereich !== 'SONSTIGE' &&
        customerMeetsPrepressContact(orderCustomer) === false &&
        (lokal.bereich === 'LFP' ||
          lokal.bereich === 'COPYSHOP' ||
          (lokal.bereich === 'STEMPEL' && lokal.typ !== 'SONSTIGE_STEMPEL') ||
          (lokal.bereich === 'LASERGRAVUR' && lokal.typ !== 'SONSTIGE_LASER')) && (
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
                checked={sepTermin}
                onChange={e => {
                  const next = e.target.checked
                  setSepTermin(next)
                  if (!next) {
                    const nextIso = auftragIso || ''
                    const nextTermin = nextIso ? nextIso : null
                    setLokal(s => ({ ...s, termin: nextTermin }))
                    void speichere({ termin: nextTermin })
                  } else {
                    // Beim Aktivieren: Eingabefeld soll den aktuellen Wert (Teilauftrag oder Auftrag) zeigen.
                    const cur = lokalR.current
                    const curIso = cur.termin
                      ? cur.termin.length > 10
                        ? cur.termin.slice(0, 10)
                        : cur.termin
                      : ''
                    if (!curIso && auftragIso) setLokal(s => ({ ...s, termin: auftragIso }))
                  }
                }}
              />
              <span>Separates Lieferdatum</span>
            </label>
            {sepTermin && (
              <div style={{ marginTop: 8 }}>
                <DateInput
                  className={'ber-inp' + gFe('termin')}
                  value={lokal.termin ? (lokal.termin.length > 10 ? lokal.termin.slice(0, 10) : lokal.termin) : iso}
                  onChange={e => {
                    const v = e.target.value
                    setLokal(s => ({ ...s, termin: v || null }))
                  }}
                  onBlur={e => {
                    const v = e.target.value || null
                    const snapIso = snapR.current.termin ? snapR.current.termin.slice(0, 10) : ''
                    if ((v ?? '') !== (snapIso ?? '')) {
                      void speichere({ termin: v })
                    }
                  }}
                />
                {pruef && gErr.termin && <p className="td-feld-err">{gErr.termin}</p>}
              </div>
            )}
            {!sepTermin && pruef && gErr.termin && <p className="td-feld-err">{gErr.termin}</p>}
          </div>
        </div>
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Lieferart</span>
          <div>
            <label className="cp-toggle" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={separateLieferung}
                onChange={e => {
                  const an = e.target.checked
                  if (!an) {
                    void speichere({ lieferung: auftragLief })
                  } else {
                    const abw = auftragLief === 'ABHOLUNG' ? 'VERSAND' : 'ABHOLUNG'
                    setLokal(s => ({ ...s, lieferung: abw }))
                    void speichere({ lieferung: abw })
                  }
                }}
              />
              <span>Separate Lieferart</span>
            </label>
            {separateLieferung ? (
              <div style={{ marginTop: 8 }}>
                <select
                  className={'ber-inp' + gFe('lieferung')}
                  value={lokal.lieferung ?? auftragLief}
                  onChange={e => {
                    const v = e.target.value as 'ABHOLUNG' | 'VERSAND'
                    setLokal(s => ({ ...s, lieferung: v }))
                  }}
                  onBlur={e => {
                    const v = (e.target.value as 'ABHOLUNG' | 'VERSAND') || auftragLief
                    if (v !== snapR.current.lieferung) void speichere({ lieferung: v })
                  }}
                >
                  <option value="ABHOLUNG">Abholung</option>
                  <option value="VERSAND">Versand</option>
                </select>
                {pruef && gErr.lieferung && <p className="td-feld-err">{gErr.lieferung}</p>}
              </div>
            ) : (
              <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
                {effLieferung === 'ABHOLUNG' ? 'Abholung' : 'Versand'}
                {pruef && gErr.lieferung && <p className="td-feld-err">{gErr.lieferung}</p>}
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
              checked={separatePrioritaet}
              onChange={e => {
                const an = e.target.checked
                if (!an) {
                  void speichere({ prioritaet: auftragPrio })
                } else {
                  const alt: Prioritaet = auftragPrio === 'HOCH' ? 'NORMAL' : 'HOCH'
                  void speichere({ prioritaet: alt })
                }
              }}
            />
            <span>Separate Priorität</span>
          </label>
          {separatePrioritaet ? (
            <div style={{ marginTop: 8 }}>
              <select
                className={'ber-inp' + gFe('prioritaet')}
                value={lokal.prioritaet}
                onChange={e => {
                  const v = e.target.value
                  if (v === 'NORMAL' || v === 'HOCH') setLokal(s => ({ ...s, prioritaet: v }))
                }}
                onBlur={e => {
                  const v = e.target.value
                  if ((v === 'NORMAL' || v === 'HOCH') && v !== snapR.current.prioritaet) {
                    void speichere({ prioritaet: v })
                  }
                }}
              >
                <option value="NORMAL">Normal</option>
                <option value="HOCH">Hoch</option>
              </select>
              {pruef && gErr.prioritaet && <p className="td-feld-err">{gErr.prioritaet}</p>}
            </div>
          ) : (
            <div className="cp-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              {effPrioritaet === 'HOCH' ? 'Hoch' : 'Normal'}
              {pruef && gErr.prioritaet && <p className="td-feld-err">{gErr.prioritaet}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="ber-zeile-stack" style={{ marginBottom: 6, maxWidth: '16rem' }}>
        <span className="ber-lbl">Satzzeit (min)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + gFe('satzzeit_minuten')}
            value={lokal.satzzeit_minuten ?? ''}
            onChange={e => {
              const raw = e.target.value
              setLokal(s => ({
                ...s,
                satzzeit_minuten: raw === '' ? null : parseInt(raw, 10),
              }))
            }}
            onBlur={e => {
              const raw = e.target.value
              const n = raw === '' ? null : parseInt(raw, 10)
              if (n !== snapR.current.satzzeit_minuten) void speichere({ satzzeit_minuten: n })
            }}
            min={1}
            style={{ maxWidth: '12rem' }}
          />
          {pruef && gErr.satzzeit_minuten && <p className="td-feld-err">{gErr.satzzeit_minuten}</p>}
        </div>
      </div>

      {lokal.bereich === 'LFP' && (
        <LFPDetail subOrder={lokal} subOrderStatus={lokal.status} onDetailPatch={onLfpPatch} orderFiles={orderFiles} />
      )}

      {lokal.bereich === 'COPYSHOP' && (
        <CopyShopDetail subOrder={lokal} subOrderStatus={lokal.status} onDetailPatch={onCopyShopPatch} orderFiles={orderFiles} />
      )}

      {lokal.bereich === 'STEMPEL' && (
        <StampDetail subOrder={lokal} subOrderStatus={lokal.status} onDetailPatch={onStempelPatch} orderFiles={orderFiles} />
      )}

      {lokal.bereich === 'SONSTIGE' && (
        <OtherDetail subOrder={lokal} subOrderStatus={lokal.status} onDetailPatch={onSonstigePatch} orderFiles={orderFiles} />
      )}

      {lokal.bereich === 'LASERGRAVUR' && (
        <LaserDetail subOrder={lokal} subOrderStatus={lokal.status} onDetailPatch={onLaserPatch} orderFiles={orderFiles} />
      )}

      {lokal.bereich === 'TEXTIL' && (
        <TextileDetail
          subOrder={lokal}
          subOrderStatus={lokal.status}
          orderStatus={orderStatus}
          orderFiles={orderFiles}
          orderCustomer={orderCustomer}
          onUpdated={onTextilTeilAktualisiert}
        />
      )}

      {lokal.bereich !== 'LFP' &&
        lokal.bereich !== 'COPYSHOP' &&
        lokal.bereich !== 'STEMPEL' &&
        lokal.bereich !== 'SONSTIGE' &&
        lokal.bereich !== 'LASERGRAVUR' &&
        lokal.bereich !== 'TEXTIL' && (
        <>
          <div className="td-zeile" style={{ marginTop: 8 }}>
            <p className="td-label">Typ</p>
            <p className="td-wert td-mono">{lokal.typ?.trim() ? lokal.typ : '—'}</p>
          </div>
          <p className="wa-hint" style={{ marginTop: 8 }}>
            Bereich {teilauftragBereichLabel(lokal.bereich)}: Detailmaske folgt (analog LFP).
          </p>
        </>
      )}
    </div>
  )
}
