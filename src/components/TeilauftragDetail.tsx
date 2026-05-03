import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { bereichKuerzel } from '../const/bereichKuerzel'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import { kundeErfuelltPrepressKontakt } from '../lib/kunde'
import {
  istTeilAuftragVollstaendig,
  nextTeilStatus,
  validateGlobalTeilfelder,
} from '../lib/teilGlobal'
import {
  teilauftragBereichLabel,
  type AuftragStatus,
  type KundeKontaktJoin,
  type LieferungWahl,
  type Prioritaet,
  type TeilauftragRow,
} from '../types/database'
import { DateInput } from './DateInput'
import { useToast } from './Toast'
import { CopyShopDetail } from './bereiche/CopyShopDetail'
import { LFPDetail } from './bereiche/LFPDetail'
import { StempelDetail } from './bereiche/StempelDetail'
import { SonstigeDetail, type SonstigeDetailJson } from './bereiche/SonstigeDetail'
import { LaserDetail } from './bereiche/LaserDetail'
import { TextilDetail } from './bereiche/TextilDetail'
import type { Datei } from './DateiListe'
import type { LfpDetailJson } from '../types/lfp'
import type { CopyShopDetailJson } from '../types/copyshop'
import type { StempelDetailJson } from '../types/stempel'
import type { LaserDetailJson } from '../types/laser'
import { generiereUndLadePdf } from '../lib/pdf/auftragsPdf'
import './WorkArea.css'

type Props = {
  teil: TeilauftragRow
  auftragStatus: AuftragStatus
  /** Auftragstermin (fallback/Vererbung) */
  auftragTermin: string | null
  /** Auftrags-Lieferung (Vererbung) */
  auftragLieferung: LieferungWahl | null
  /** Auftrags-Priorität (Vererbung) */
  auftragPrioritaet: Prioritaet
  /** Server-Join für Kundenkontakt (name, email, telefon) */
  auftragKunde: KundeKontaktJoin
  auftragDateien: Datei[]
  onAktualisiert: (t: TeilauftragRow) => void
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

export function TeilauftragDetail({
  teil,
  auftragStatus,
  auftragTermin,
  auftragLieferung,
  auftragPrioritaet,
  auftragKunde,
  auftragDateien,
  onAktualisiert,
}: Props) {
  const snapR = useRef(teil)
  const lokalR = useRef(teil)
  const [lokal, setLokal] = useState(teil)
  const [speichLad, setSpeichLad] = useState(false)
  const { fehler } = useToast()

  const auftragLief = (auftragLieferung ?? 'ABHOLUNG') as LieferungWahl
  const auftragPrio: Prioritaet = auftragPrioritaet

  useEffect(() => {
    if (teil.id !== lokalR.current.id) {
      // Anderer Teilaufrag — immer neu laden
      setLokal(teil)
      snapR.current = teil
      lokalR.current = teil
      return
    }
    // Gleicher Teilaufrag — nur updaten, wenn Status oder Detail sich geändert haben
    if (
      teil.status !== lokalR.current.status ||
      JSON.stringify(teil.detail) !== JSON.stringify(lokalR.current.detail)
    ) {
      setLokal(prev => ({
        ...prev,
        status: teil.status,
        detail: teil.detail,
      }))
      snapR.current = teil
      lokalR.current = teil
    }
  }, [teil])

  useEffect(() => {
    lokalR.current = lokal
  }, [lokal])

  const tStatus = lokal.status
  const pruef = tStatus !== 'ANGEBOT'
  const separateLieferung = lokal.lieferung != null && lokal.lieferung !== auftragLief
  const separatePrioritaet = lokal.prioritaet !== auftragPrio
  const effLieferung = (separateLieferung ? lokal.lieferung! : auftragLief) as LieferungWahl
  const effPrioritaet = separatePrioritaet ? lokal.prioritaet : auftragPrio
  const gErr = validateGlobalTeilfelder(
    {
      ...lokal,
      lieferung: effLieferung,
      prioritaet: effPrioritaet,
    },
    tStatus
  )
  const gFe = (k: string) => (pruef && gErr[k] ? ' ber-inp--err' : '')

  const kundePre = kundeErfuelltPrepressKontakt(auftragKunde)

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
      const voll = istTeilAuftragVollstaendig(mergedNorm, snap.status)
      const nSt = nextTeilStatus(snap.status, snap, merged, voll, kundePre, auftragStatus)
      const statusVorher = snapR.current.status
      setSpeichLad(true)
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ ...patch, status: nSt } as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
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
        onAktualisiert(row)
        if (row.status === 'PREPRESS_BEREIT' && statusVorher !== 'PREPRESS_BEREIT') {
          const pdfOk = await generiereUndLadePdf(teil.id, teil.auftrag_id)
          if (!pdfOk) fehler('PDF konnte nicht erstellt werden')
        }
      }
    },
    [auftragLief, teil.id, teil.auftrag_id, auftragStatus, onAktualisiert, kundePre, fehler]
  )

  const onLfpPatch = useCallback(
    async (p: { typ?: string | null; detail: LfpDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as LfpDetailJson,
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
    async (p: { typ?: string | null; detail: StempelDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as StempelDetailJson,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const onSonstigePatch = useCallback(
    async (p: { typ?: string | null; detail: SonstigeDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: (p.detail ?? {}) as SonstigeDetailJson,
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
      onAktualisiert(row)
    },
    [onAktualisiert]
  )

  const globTermin = lokal.termin ?? auftragTermin
  const iso = globTermin
    ? globTermin.length > 10
      ? globTermin.slice(0, 10)
      : globTermin
    : ''

  const auftragIso = auftragTermin ? (auftragTermin.length > 10 ? auftragTermin.slice(0, 10) : auftragTermin) : ''

  const [sepTermin, setSepTermin] = useState(false)

  useEffect(() => {
    const tNorm = normTeilTermin(teil.termin)
    const aNorm = normTeilTermin(auftragTermin)
    setSepTermin(tNorm != null && aNorm != null && tNorm !== aNorm)
  }, [teil.id, teil.termin, auftragTermin])

  useEffect(() => {
    // Vererbung beim Laden: wenn Teilauftrag-Termin null und Auftrag hat Termin → im Hintergrund speichern.
    if (!teil.id) return
    if (snapR.current.termin != null) return
    if (!auftragIso) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('teilauftraege')
            .update({ termin: auftragIso } as never)
            .eq('id', teil.id)
            .select(TEILAUFTRAG_SPALTEN)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
            onAktualisiert(row)
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
  }, [auftragIso, onAktualisiert, teil.id, fehler])

  useEffect(() => {
    if (!teil.id) return
    if (lokal.lieferung != null) return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('teilauftraege')
            .update({ lieferung: auftragLief } as never)
            .eq('id', teil.id)
            .select(TEILAUFTRAG_SPALTEN)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
            onAktualisiert(row)
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
  }, [auftragLief, lokal.lieferung, onAktualisiert, teil.id, fehler])

  useEffect(() => {
    if (!teil.id) return
    if (lokal.prioritaet !== 'NORMAL') return
    if (!auftragPrio || auftragPrio === 'NORMAL') return
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('teilauftraege')
            .update({ prioritaet: auftragPrio })
            .eq('id', teil.id)
            .select(TEILAUFTRAG_SPALTEN)
            .single()
          if (!alive) return
          if (error) throw error
          if (data) {
            const row = data as TeilauftragRow
            if (!alive) return
            snapR.current = row
            lokalR.current = row
            setLokal(row)
            onAktualisiert(row)
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
  }, [auftragPrio, lokal.prioritaet, onAktualisiert, teil.id, fehler])

  const tBadge = teilStatusBadgeAuf(lokal.status)

  return (
    <div className="td">
      <div className="td-kopf" aria-label="Teilauftrag">
        <span className="td-bkz">[{bereichKuerzel(lokal.bereich)}]</span>
        <span className={`badge ${tBadge.cls}`}>
          {tBadge.label}
          {speichLad ? ' …' : ''}
        </span>
      </div>
      {pruef &&
        lokal.bereich !== 'SONSTIGE' &&
        kundeErfuelltPrepressKontakt(auftragKunde) === false &&
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
        <LFPDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onLfpPatch} auftragDateien={auftragDateien} />
      )}

      {lokal.bereich === 'COPYSHOP' && (
        <CopyShopDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onCopyShopPatch} auftragDateien={auftragDateien} />
      )}

      {lokal.bereich === 'STEMPEL' && (
        <StempelDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onStempelPatch} auftragDateien={auftragDateien} />
      )}

      {lokal.bereich === 'SONSTIGE' && (
        <SonstigeDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onSonstigePatch} auftragDateien={auftragDateien} />
      )}

      {lokal.bereich === 'LASERGRAVUR' && (
        <LaserDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onLaserPatch} auftragDateien={auftragDateien} />
      )}

      {lokal.bereich === 'TEXTIL' && (
        <TextilDetail
          teil={lokal}
          teilStatus={lokal.status}
          auftragStatus={auftragStatus}
          auftragDateien={auftragDateien}
          auftragKunde={auftragKunde}
          onAktualisiert={onTextilTeilAktualisiert}
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
