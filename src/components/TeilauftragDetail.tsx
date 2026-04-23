import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { TEILAUFTRAG_SPALTEN } from '../const/teilauftragSelect'
import { kundeErfuelltPrepressKontakt } from '../lib/kunde'
import {
  istTeilAuftragVollstaendig,
  nextTeilStatus,
  validateGlobalTeilfelder,
} from '../lib/teilGlobal'
import { teilauftragBereichLabel, type KundeKontaktJoin, type TeilauftragRow } from '../types/database'
import { LFPDetail } from './bereiche/LFPDetail'
import type { LfpDetailJson } from '../types/lfp'
import './WorkArea.css'

type Props = {
  teil: TeilauftragRow
  /** Server-Join für Kundenkontakt (name, email, telefon) */
  auftragKunde: KundeKontaktJoin
  onAktualisiert: (t: TeilauftragRow) => void
}

type MitarbeiterZeile = {
  id: string
  email: string
}

export function TeilauftragDetail({ teil, auftragKunde, onAktualisiert }: Props) {
  const snapR = useRef(teil)
  const lokalR = useRef(teil)
  const [lokal, setLokal] = useState(teil)
  const [mitarbeiter, setMitarbeiter] = useState<MitarbeiterZeile[]>([])
  const [speichLad, setSpeichLad] = useState(false)

  useEffect(() => {
    supabase
      .from('mitarbeiter')
      .select('id, email')
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          return
        }
        setMitarbeiter((data ?? []) as MitarbeiterZeile[])
      })
  }, [])

  useEffect(() => {
    snapR.current = teil
    lokalR.current = teil
    // eslint-disable-next-line react-hooks/set-state-in-effect -- externe Prop: Server-Teilauftrag nach Reload/Eltern-Update
    setLokal(teil)
  }, [teil])

  useEffect(() => {
    lokalR.current = lokal
  }, [lokal])

  const tStatus = lokal.status
  const pruef = tStatus !== 'ANGEBOT'
  const gErr = validateGlobalTeilfelder(lokal, tStatus)
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
      const voll = istTeilAuftragVollstaendig(merged, snap.status)
      const nSt = nextTeilStatus(snap.status, snap, merged, voll, kundePre)
      setSpeichLad(true)
      const { data, error } = await supabase
        .from('teilauftraege')
        .update({ ...patch, status: nSt } as never)
        .eq('id', teil.id)
        .select(TEILAUFTRAG_SPALTEN)
        .single()
      setSpeichLad(false)
      if (error) {
        console.error(error)
        return
      }
      if (data) {
        const row = data as TeilauftragRow
        snapR.current = row
        lokalR.current = row
        setLokal(row)
        onAktualisiert(row)
      }
    },
    [teil.id, onAktualisiert, kundePre]
  )

  const onLfpPatch = useCallback(
    async (p: { typ?: string | null; detail: LfpDetailJson | null }) => {
      await speichere({
        typ: p.typ,
        detail: p.detail,
      } as Partial<TeilauftragRow>)
    },
    [speichere]
  )

  const globTermin = lokal.termin
  const iso = globTermin
    ? globTermin.length > 10
      ? globTermin.slice(0, 10)
      : globTermin
    : ''

  const bekannteMitarbeiterIds = new Set(mitarbeiter.map(m => m.id))
  const verantwortIdOhneEintrag =
    lokal.verantwortlicher_id && !bekannteMitarbeiterIds.has(lokal.verantwortlicher_id)
      ? lokal.verantwortlicher_id
      : null

  return (
    <div className="td">
      <div className="td-zeile">
        <p className="td-label">Bereich</p>
        <p className="td-wert">{teilauftragBereichLabel(lokal.bereich)}</p>
      </div>
      <div className="td-zeile">
        <p className="td-label">Status</p>
        <p className="td-wert td-mono">
          {lokal.status}
          {speichLad ? ' …' : ''}
        </p>
      </div>
      {pruef && kundeErfuelltPrepressKontakt(auftragKunde) === false && (
        <p className="ber-hinweis">Für Auto-PREPRESS: Kunde braucht Name und E-Mail oder Telefon.</p>
      )}

      <h3 className="ber-h3" style={{ marginTop: '0.5rem' }}>
        Allgemein
      </h3>
      <div className="ber-zeile">
        <span className="ber-lbl">Termin</span>
        <div>
          <input
            type="date"
            className={'ber-inp' + gFe('termin')}
            value={iso}
            onChange={e => {
              const v = e.target.value
              setLokal(s => ({ ...s, termin: v || null }))
            }}
            onBlur={e => {
              const v = e.target.value || null
              if (v !== (snapR.current.termin ? snapR.current.termin.slice(0, 10) : '')) {
                void speichere({ termin: v })
              }
            }}
          />
          {pruef && gErr.termin && <p className="td-feld-err">{gErr.termin}</p>}
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Lieferung</span>
        <div>
          <select
            className={'ber-inp' + gFe('lieferung')}
            value={lokal.lieferung ?? ''}
            onChange={e => {
              const v = e.target.value
              setLokal(s => ({
                ...s,
                lieferung: (v as 'ABHOLUNG' | 'VERSAND') || null,
              }))
            }}
            onBlur={e => {
              const v = (e.target.value as 'ABHOLUNG' | 'VERSAND') || null
              if (v !== snapR.current.lieferung) void speichere({ lieferung: v })
            }}
          >
            <option value="">—</option>
            <option value="ABHOLUNG">Abholung</option>
            <option value="VERSAND">Versand</option>
          </select>
          {pruef && gErr.lieferung && <p className="td-feld-err">{gErr.lieferung}</p>}
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Priorität</span>
        <div>
          <select
            className={'ber-inp' + gFe('prioritaet')}
            value={lokal.prioritaet}
            onChange={e => setLokal(s => ({ ...s, prioritaet: e.target.value }))}
            onBlur={e => {
              if (e.target.value !== snapR.current.prioritaet) {
                void speichere({ prioritaet: e.target.value })
              }
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>
          {pruef && gErr.prioritaet && <p className="td-feld-err">{gErr.prioritaet}</p>}
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Verantwortlicher</span>
        <div>
          <select
            className={'ber-inp' + gFe('verantwortlicher_id')}
            value={lokal.verantwortlicher_id ?? ''}
            onChange={e => {
              const v = e.target.value
              setLokal(s => ({ ...s, verantwortlicher_id: v || null }))
            }}
            onBlur={e => {
              const v = e.target.value || null
              if (v !== (snapR.current.verantwortlicher_id ?? null)) {
                void speichere({ verantwortlicher_id: v })
              }
            }}
          >
            <option value="">—</option>
            {verantwortIdOhneEintrag && (
              <option value={verantwortIdOhneEintrag}>
                {verantwortIdOhneEintrag} (nicht in Liste)
              </option>
            )}
            {mitarbeiter.map(m => (
              <option key={m.id} value={m.id}>
                {m.email}
              </option>
            ))}
          </select>
          {pruef && gErr.verantwortlicher_id && <p className="td-feld-err">{gErr.verantwortlicher_id}</p>}
        </div>
      </div>
      <div className="ber-zeile">
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
          />
          {pruef && gErr.satzzeit_minuten && <p className="td-feld-err">{gErr.satzzeit_minuten}</p>}
        </div>
      </div>

      {lokal.bereich === 'LFP' && (
        <LFPDetail teil={lokal} teilStatus={lokal.status} onDetailPatch={onLfpPatch} />
      )}

      {lokal.bereich !== 'LFP' && (
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
