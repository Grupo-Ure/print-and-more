import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabase'
import {
  LASER_ORIGINS,
  LASER_ORIGIN_LABELS,
  LASER_SIGN_MATERIALS,
  LASER_SIGN_MATERIAL_LABELS,
  LASER_TYPES,
  LASER_TYPE_LABELS,
  type LaserDetailJson,
} from '../../types/laser'
import { validateLaserDetail } from '../../lib/laser/validateLaserDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import type { Datei } from '../FileList'
import { useToast } from '../Toast'
import '../WorkArea.css'

type Props = {
  subOrder: TeilauftragRow
  subOrderStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: LaserDetailJson | null }) => Promise<void>
  orderFiles?: Datei[]
}

type ProduktRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: LaserDetailJson
  sort_order: number | null
  erstellt_am: string | null
}

function laserRoh(subOrder: TeilauftragRow): LaserDetailJson {
  const d = subOrder.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: LaserDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: LaserDetailJson) => void
  commit: () => void
  speichDetail: (d: LaserDetailJson) => void
}

const SCHILD_T = new Set(['SCHILD', 'POKALSCHILD', 'NAMENSSCHILD'])

type ProduktDateiZuordnung = { zuordnungId: string; dateiId: string }

export function LaserDetail({
  subOrder,
  subOrderStatus,
  onDetailPatch,
  orderFiles = [],
}: Props) {
  const { fehler: toastFehler } = useToast()

  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [produktDateien, setProduktDateien] = useState<Record<string, ProduktDateiZuordnung[]>>({})
  const produktDateienRef = useRef(produktDateien)
  produktDateienRef.current = produktDateien
  const [produkteLaden, setProdukteLaden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entsperrt, setEntsperrt] = useState(false)
  const [formDateiIds, setFormDateiIds] = useState<string[]>([])

  const [typ, setTyp] = useState<string | null>(subOrder.typ)
  const [detail, setDetail] = useState<LaserDetailJson>(laserRoh(teil))
  const detailR = useRef(detail)
  const typR = useRef(typ)
  useEffect(() => {
    detailR.current = detail
  }, [detail])
  useEffect(() => {
    typR.current = typ
  }, [typ])

  useEffect(() => {
    setEditingId(null)
    setFormDateiIds([])
  }, [subOrder.id])

  useEffect(() => {
    setEntsperrt(false)
  }, [subOrder.id])

  useEffect(() => {
    if (editingId !== null) return
    setTyp(subOrder.typ)
    const d = laserRoh(teil)
    setDetail(d)
    detailR.current = d
    typR.current = subOrder.typ
  }, [subOrder, editingId])

  const ladeDateienFuerProdukte = useCallback(
    async (produktRows: ProduktRow[]) => {
      const ids = produktRows.map(p => p.id)
      if (ids.length === 0) {
        setProduktDateien({})
        return
      }
      const { data, error } = await supabase
        .from('produkt_dateien')
        .select('id, produkt_id, datei_id')
        .in('produkt_id', ids)
      if (error) {
        toastFehler('Datei-Zuordnungen konnten nicht geladen werden')
        setProduktDateien({})
        return
      }
      const rows = (data ?? []) as Pick<
        Database['public']['Tables']['produkt_dateien']['Row'],
        'id' | 'produkt_id' | 'datei_id'
      >[]
      const next: Record<string, ProduktDateiZuordnung[]> = {}
      for (const row of rows) {
        const list = next[row.produkt_id] ?? (next[row.produkt_id] = [])
        list.push({ zuordnungId: row.id, dateiId: row.datei_id })
      }
      setProduktDateien(next)
    },
    [toastFehler],
  )

  const reloadProdukte = useCallback(async (): Promise<ProduktRow[]> => {
    if (!subOrder.id) {
      await ladeDateienFuerProdukte([])
      return []
    }
    setProdukteLaden(true)
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', subOrder.id)
      .eq('bereich', 'LASERGRAVUR')
      .order('sort_order')
    setProdukteLaden(false)
    if (error) {
      toastFehler('Produkte konnten nicht geladen werden')
      setProdukte([])
      await ladeDateienFuerProdukte([])
      return []
    }
    const rows = (data ?? []) as Database['public']['Tables']['teilauftrag_produkte']['Row'][]
    const mapped: ProduktRow[] = rows.map(r => ({
      id: r.id,
      teilauftrag_id: r.teilauftrag_id,
      bereich: r.bereich,
      detail: (r.detail ?? {}) as LaserDetailJson,
      sort_order: r.sort_order,
      erstellt_am: r.erstellt_am,
    }))
    setProdukte(mapped)
    await ladeDateienFuerProdukte(mapped)
    return mapped
  }, [subOrder.id, toastFehler, ladeDateienFuerProdukte])

  useEffect(() => {
    void reloadProdukte()
  }, [reloadProdukte])

  const dateiZuProduktZuordnen = useCallback(
    async (produktId: string, dateiId: string, produktRowsForReload?: ProduktRow[]) => {
      const reloadRows = produktRowsForReload ?? produkte
      if (produktDateienRef.current[produktId]?.some(z => z.dateiId === dateiId)) return
      const ins: Database['public']['Tables']['produkt_dateien']['Insert'] = {
        produkt_id: produktId,
        datei_id: dateiId,
      }
      const { error } = await supabase.from('produkt_dateien').insert(ins)
      if (error) {
        toastFehler('Datei konnte nicht zugeordnet werden')
        return
      }
      await ladeDateienFuerProdukte(reloadRows)
    },
    [toastFehler, produkte, ladeDateienFuerProdukte],
  )

  const dateiVonProduktEntfernen = useCallback(
    async (zuordnungId: string, produktRowsForReload?: ProduktRow[]) => {
      const { error } = await supabase.from('produkt_dateien').delete().eq('id', zuordnungId)
      if (error) {
        toastFehler('Zuordnung konnte nicht entfernt werden')
        return
      }
      await ladeDateienFuerProdukte(produktRowsForReload ?? produkte)
    },
    [toastFehler, produkte, ladeDateienFuerProdukte],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormDateiIds([])
    setTyp(subOrder.typ)
    const d = laserRoh(teil)
    setDetail(d)
    detailR.current = d
    typR.current = subOrder.typ
  }, [teil])

  const laserFehler = validateLaserDetail(typ, detail, subOrderStatus)
  const pruef = subOrderStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && laserFehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (nextTyp: string | null, d: LaserDetailJson) => {
      let out = d
      if (nextTyp === 'NAMENSSCHILD' && d && typeof d === 'object') {
        out = { ...d }
        delete (out as Record<string, unknown>).selbstklebend
      }
      setDetail(out)
      detailR.current = out
      setTyp(nextTyp)
      if (editingId !== null) return
      await onDetailPatch({ typ: nextTyp, detail: out })
    },
    [onDetailPatch, editingId]
  )

  const patchL = useCallback((p: LaserDetailJson) => {
    setDetail(d0 => {
      const n = { ...d0, ...p }
      detailR.current = n
      return n
    })
  }, [])

  const commit = useCallback(() => {
    void speich(typR.current, { ...detailR.current })
  }, [speich])

  const speichDetail = useCallback(
    (d: LaserDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: laserFehler, patchL, commit, speichDetail }

  const formOk = useMemo(() => Object.keys(laserFehler).length === 0, [laserFehler])

  const brauchtEntsperr =
    (subOrderStatus === 'PREPRESS_BEREIT' || subOrderStatus === 'PRODUKTION_BEREIT') && !entsperrt

  const handleAddOrSave = useCallback(async () => {
    const t = typR.current
    const d0 = { ...detailR.current }
    if (!t) return
    const errors = validateLaserDetail(t, d0, subOrderStatus)
    if (Object.keys(errors).length > 0) return

    let d = d0
    if (t === 'NAMENSSCHILD' && d && typeof d === 'object') {
      d = { ...d0 }
      delete (d as Record<string, unknown>).selbstklebend
    }

    if (editingId) {
      const patch: Database['public']['Tables']['teilauftrag_produkte']['Update'] = {
        detail: { ...d, typ: t } as Json,
      }
      const { error } = await supabase.from('teilauftrag_produkte').update(patch).eq('id', editingId)
      if (error) {
        toastFehler('Produkt konnte nicht gespeichert werden')
        return
      }
      for (const z of [...(produktDateien[editingId] ?? [])]) {
        await dateiVonProduktEntfernen(z.zuordnungId)
      }
      for (const fid of formDateiIds) {
        await dateiZuProduktZuordnen(editingId, fid)
      }
      const list = await reloadProdukte()
      await onDetailPatch({
        typ: subOrder.typ,
        detail: {
          ...laserRoh(teil),
          hat_produkte: list.length > 0,
        } as LaserDetailJson,
      })
      resetForm()
      return
    }

    const ins: Database['public']['Tables']['teilauftrag_produkte']['Insert'] = {
      teilauftrag_id: subOrder.id,
      bereich: 'LASERGRAVUR',
      detail: { ...d, typ: t } as Json,
      sort_order: produkte.length,
    }
    const { data: insRow, error } = await supabase.from('teilauftrag_produkte').insert(ins).select('id').single()
    if (error) {
      toastFehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    const newId = insRow?.id != null ? String(insRow.id) : ''
    if (!newId) {
      toastFehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    let list = await reloadProdukte()
    for (const fid of formDateiIds) {
      await dateiZuProduktZuordnen(newId, fid, list)
    }
    list = await reloadProdukte()
    await onDetailPatch({
      typ: subOrder.typ,
      detail: {
        ...laserRoh(teil),
        hat_produkte: list.length > 0,
      } as LaserDetailJson,
    })
    resetForm()
  }, [
    subOrder,
    subOrderStatus,
    editingId,
    produkte.length,
    produktDateien,
    formDateiIds,
    toastFehler,
    reloadProdukte,
    resetForm,
    onDetailPatch,
    dateiZuProduktZuordnen,
    dateiVonProduktEntfernen,
  ])

  const handleDelete = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('teilauftrag_produkte').delete().eq('id', id)
      if (error) {
        toastFehler('Produkt konnte nicht gelöscht werden')
        return
      }
      const list = await reloadProdukte()
      await onDetailPatch({
        typ: subOrder.typ,
        detail: {
          ...laserRoh(teil),
          hat_produkte: list.length > 0,
        } as LaserDetailJson,
      })
      if (editingId === id) resetForm()
    },
    [toastFehler, reloadProdukte, editingId, resetForm, onDetailPatch, teil]
  )

  const handleEdit = useCallback((row: ProduktRow) => {
    setEditingId(row.id)
    setFormDateiIds(produktDateien[row.id]?.map(z => z.dateiId) ?? [])
    const raw = row.detail ?? {}
    const dr = raw as Record<string, unknown>
    const tt = typeof dr.typ === 'string' ? dr.typ : null
    setTyp(tt)
    const dd = { ...(raw as LaserDetailJson) }
    setDetail(dd)
    detailR.current = dd
    typR.current = tt
  }, [produktDateien])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Lasergravur-Details</h3>
      {typ === 'SONSTIGE_LASER' && (
        <p className="ber-hinweis">Bei &apos;Sonstige Laser&apos; wird PREPRESS_BEREIT nur manuell gesetzt.</p>
      )}

      <BerZeile
        l="Typ"
        e={pruef && laserFehler.typ ? laserFehler.typ : undefined}
        c={
          <select
            className={'ber-inp' + fe('typ')}
            value={typ ?? ''}
            onChange={e => {
              const v = e.target.value
              if (v !== (typ ?? '')) {
                setTyp(v || null)
                setDetail({})
                detailR.current = {}
                typR.current = v || null
                if (editingId === null) void speich(v || null, {})
              } else {
                setTyp(v || null)
                typR.current = v || null
              }
            }}
          >
            <option value="">—</option>
            {LASER_TYPES.map(x => (
              <option key={x} value={x}>
                {LASER_TYPE_LABELS[x]}
              </option>
            ))}
          </select>
        }
      />

      <NmbStueckzahl {...p} />

      {typ && SCHILD_T.has(typ) && <SchildGruppe p={p} schildTyp={typ} />}
      {typ === 'GESCHENKARTIKEL' && <GeschenkGruppe p={p} />}
      {typ === 'SONSTIGE_LASER' && <SonstigeLaserGruppe p={p} />}

      <Txt
        {...p}
        k="besonderheiten"
        l="Besonderheiten (optional)"
        rows={3}
        optional
      />

      {orderFiles.length > 0 && (
        <BerZeile l="Dateien">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {formDateiIds.map(fid => (
              <span
                key={fid}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {orderFiles.find(df => df.id === fid)?.anzeigename ?? fid}
                </span>
                <button
                  type="button"
                  className="cp-btn cp-btn-grau"
                  style={{ minWidth: 22, padding: '0 6px', fontSize: 14, lineHeight: 1 }}
                  title="Entfernen"
                  onClick={() => setFormDateiIds(prev => prev.filter(x => x !== fid))}
                >
                  ×
                </button>
              </span>
            ))}
            <select
              key={formDateiIds.join('|')}
              className="ber-inp"
              style={{ fontSize: 12, maxWidth: 260 }}
              defaultValue=""
              onChange={e => {
                const v = e.target.value
                if (v && !formDateiIds.includes(v)) {
                  setFormDateiIds(prev => [...prev, v])
                }
              }}
            >
              <option value="">Datei hinzufügen…</option>
              {orderFiles
                .filter(df => !formDateiIds.includes(df.id))
                .map(df => (
                  <option key={df.id} value={df.id}>
                    {df.anzeigename}
                  </option>
                ))}
            </select>
          </div>
        </BerZeile>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="cp-btn"
          disabled={brauchtEntsperr ? false : !typ || !formOk}
          onClick={() => {
            if (brauchtEntsperr) {
              if (
                window.confirm(
                  'Teilauftrag ist bereits freigegeben.\nWirklich Produkte bearbeiten?',
                )
              ) {
                setEntsperrt(true)
              }
              return
            }
            void handleAddOrSave()
          }}
        >
          {brauchtEntsperr
            ? 'Bearbeitung entsperren'
            : editingId
              ? 'Speichern'
              : 'Produkt hinzufügen'}
        </button>
        {editingId && (
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => resetForm()}>
            Abbrechen
          </button>
        )}
      </div>
      {entsperrt && (
        <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Bearbeitung entsperrt — Änderungen setzen Status zurück
        </p>
      )}

      <div style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', marginTop: 10, paddingTop: 10 }}>
        <h3 className="wa-dl-titel" style={{ margin: 0 }}>
          Produkte
        </h3>
        {produkteLaden ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Lädt Produkte …
          </p>
        ) : produkte.length === 0 ? (
          <p className="ber-hinweis" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Noch keine Produkte.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Typ
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Stückzahl
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Material
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Beschreibung
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {produkte.map(r => {
                  const pd = (r.detail ?? {}) as Record<string, unknown>
                  const pt = typeof pd.typ === 'string' ? pd.typ : ''
                  const st = pd.stueckzahl ?? ''
                  const matRaw = pd.material_schild ?? pd.material
                  const mat = matRaw != null ? String(matRaw) : '—'
                  const beschr = pd.beschreibung != null ? String(pd.beschreibung).slice(0, 48) : '—'
                  const typLabel = (LASER_TYPE_LABELS as Record<string, string>)[pt] ?? pt
                  const zuo = produktDateien[r.id] ?? []
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typLabel || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(st || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{mat}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{beschr}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="cp-btn cp-btn-grau" onClick={() => handleEdit(r)}>
                            Bearbeiten
                          </button>
                          <button type="button" className="cp-btn cp-btn-rot" onClick={() => void handleDelete(r.id)}>
                            Löschen
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            marginTop: 6,
                            color: 'var(--color-muted-fg, #6b7280)',
                          }}
                        >
                          {zuo.length === 0
                            ? '—'
                            : zuo
                                .map(
                                  z =>
                                    orderFiles.find(df => df.id === z.dateiId)?.anzeigename ?? z.dateiId,
                                )
                                .join(', ')}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function BerZeile({ l, c, e, children }: { l: string; c?: React.ReactNode; e?: string; children?: React.ReactNode }) {
  const inhalt = c ?? children
  return (
    <div className="ber-zeile">
      <span className="ber-lbl">{l}</span>
      <div>
        {inhalt}
        {e && <p className="ber-err">{e}</p>}
      </div>
    </div>
  )
}

function NmbStueckzahl(a: BlK) {
  const { d, fe, f, pruef, patchL, commit } = a
  const raw = d.stueckzahl
  let numForInput: number | '' = ''
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) numForInput = raw
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 1) numForInput = n
  }
  return (
    <BerZeile l="Stückzahl" e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('stueckzahl')}
        value={numForInput}
        onChange={e => {
          const v = e.target.value
          patchL({ stueckzahl: v === '' ? null : parseInt(v, 10) } as LaserDetailJson)
        }}
        onBlur={commit}
        min={1}
      />
    </BerZeile>
  )
}

function boolSel(a: BlK & { k: string; l: string }) {
  const { k, d, fe, f, pruef, speichDetail, l: lb } = a
  const v = (d as Record<string, unknown>)[k]
  const s = v === true ? 'true' : v === false ? 'false' : ''
  return (
    <BerZeile l={lb} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={s}
        onChange={e => {
          const t = e.target.value
          const b: true | false | undefined = t === 'true' ? true : t === 'false' ? false : undefined
          speichDetail({ ...d, [k]: b } as LaserDetailJson)
        }}
      >
        <option value="">—</option>
        <option value="true">Ja</option>
        <option value="false">Nein</option>
      </select>
    </BerZeile>
  )
}

function Txt(
  a: BlK & { k: string; l: string; rows?: number; optional?: boolean },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, rows = 1, optional } = a
  const val = String((d as Record<string, string>)[k] ?? '')
  const err = pruef && f[k] && !optional ? f[k] : undefined
  return (
    <BerZeile l={l} e={err}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp' + (pruef && f[k] && !optional ? fe(k) : '')}
          rows={rows}
          value={val}
          onChange={e => patchL({ [k]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + (pruef && f[k] && !optional ? fe(k) : '')}
          value={val}
          onChange={e => patchL({ [k]: e.target.value } as LaserDetailJson)}
          onBlur={commit}
        />
      )}
    </BerZeile>
  )
}

function MasseBreiteHoeheMm(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const msg = pruef ? f.format_masse : undefined
  const r = d as Record<string, number | null | undefined>
  const b = r.format_breite
  const h = r.format_hoehe
  const sb = b === null || b === undefined ? '' : String(b)
  const sh = h === null || h === undefined ? '' : String(h)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Format Breite (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('format_masse')}
            min={1}
            step={1}
            value={sb}
            onChange={e => {
              const raw = e.target.value
              const n = raw === '' ? null : parseInt(raw, 10)
              patchL({
                format_breite: n === null || Number.isNaN(n) ? null : n,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      <div className="ber-zeile">
        <span className="ber-lbl">Format Höhe (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('format_masse')}
            min={1}
            step={1}
            value={sh}
            onChange={e => {
              const raw = e.target.value
              const n = raw === '' ? null : parseInt(raw, 10)
              patchL({
                format_hoehe: n === null || Number.isNaN(n) ? null : n,
              } as LaserDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      {msg && <p className="ber-err">{msg}</p>}
    </div>
  )
}

function SchildGruppe({ p, schildTyp }: { p: BlK; schildTyp: string }) {
  const d = p.d as Record<string, string | null | boolean | number | undefined>
  const m = String(d.material ?? '')
  return (
    <>
      <BerZeile
        l="Material"
        e={p.pruef && (p.f.material || p.f.material_sonstige) ? p.f.material || p.f.material_sonstige : undefined}
        c={
          <div>
            <select
              className={'ber-inp' + p.fe('material')}
              value={m}
              onChange={e => {
                const v = e.target.value
                p.speichDetail({
                  ...p.d,
                  material: v || null,
                  material_sonstige: v === 'SONSTIGE' ? d.material_sonstige : null,
                } as LaserDetailJson)
              }}
            >
              <option value="">—</option>
              {LASER_SIGN_MATERIALS.map(fv => (
                <option key={fv} value={fv}>
                  {LASER_SIGN_MATERIAL_LABELS[fv]}
                </option>
              ))}
            </select>
            {m === 'SONSTIGE' && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className={'ber-inp' + p.fe('material_sonstige')}
                  placeholder="Material (Freitext)"
                  value={String(d.material_sonstige ?? '')}
                  onChange={e => p.patchL({ material_sonstige: e.target.value || null } as LaserDetailJson)}
                  onBlur={p.commit}
                />
              </div>
            )}
          </div>
        }
      />
      <MasseBreiteHoeheMm {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {schildTyp !== 'NAMENSSCHILD' && boolSel({ ...p, k: 'selbstklebend', l: 'Selbstklebend' })}
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}

function GeschenkGruppe({ p }: { p: BlK }) {
  const d = p.d as Record<string, string>
  return (
    <>
      <Txt {...p} k="material_freitext" l="Material" rows={2} />
      <BerZeile
        l="Herkunft"
        e={p.pruef && p.f.herkunft ? p.f.herkunft : undefined}
        c={
          <select
            className={'ber-inp' + p.fe('herkunft')}
            value={d.herkunft ?? ''}
            onChange={e =>
              p.speichDetail({ ...p.d, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_ORIGINS.map(hk => (
              <option key={hk} value={hk}>
                {LASER_ORIGIN_LABELS[hk]}
              </option>
            ))}
          </select>
        }
      />
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}

function SonstigeLaserGruppe({ p }: { p: BlK }) {
  const d = p.d as Record<string, string>
  return (
    <>
      <Txt {...p} k="material_freitext" l="Material (optional)" optional rows={2} />
      {boolSel({ ...p, k: 'selbstklebend', l: 'Selbstklebend' })}
      <BerZeile
        l="Herkunft"
        e={p.pruef && p.f.herkunft ? p.f.herkunft : undefined}
        c={
          <select
            className={'ber-inp' + p.fe('herkunft')}
            value={d.herkunft ?? ''}
            onChange={e =>
              p.speichDetail({ ...p.d, herkunft: e.target.value || null } as LaserDetailJson)
            }
          >
            <option value="">—</option>
            {LASER_ORIGINS.map(hk => (
              <option key={hk} value={hk}>
                {LASER_ORIGIN_LABELS[hk]}
              </option>
            ))}
          </select>
        }
      />
      <Txt {...p} k="motiv" l="Motiv / Inhalt" rows={5} />
    </>
  )
}
