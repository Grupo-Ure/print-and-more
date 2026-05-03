import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../supabase'
import { LFP_TEILTYP_ANZEIGE, LFP_TEILTYPEN, type LfpDetailJson } from '../../types/lfp'
import { validateLfpDetail } from '../../lib/lfp/validateLfpDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import {
  LFP_3551_VARIANTEN,
  LFP_AUFKLEBER_MATERIALIEN,
  LFP_FOLIENPLOTT_MATERIALIEN,
} from '../../config/materialien'
import type { Datei } from '../DateiListe'
import { DateInput } from '../DateInput'
import { useToast } from '../Toast'
import '../WorkArea.css'

type ProduktRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: LfpDetailJson
  sort_order: number | null
  erstellt_am: string | null
}

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: LfpDetailJson | null }) => Promise<void>
  /** Auftragsdateien für Zuordnung zu Produktzeilen */
  auftragDateien?: Datei[]
}

function lfpRoh(teil: TeilauftragRow): LfpDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: LfpDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: LfpDetailJson) => void
  commit: () => void
  /** Komplettes detail in State schreiben und sofort persistieren (z. B. Bauzaunbanner-Defaults) */
  speichDetail: (d: LfpDetailJson) => void
}

/** produkt_id → Zuordnungen (datei_id + produkt_dateien-Zeile für Entfernen) */
type ProduktDateiZuordnung = { zuordnungId: string; dateiId: string }

export function LFPDetail({
  teil,
  teilStatus,
  onDetailPatch,
  auftragDateien = [],
}: Props) {
  const { fehler } = useToast()

  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [produktDateien, setProduktDateien] = useState<Record<string, ProduktDateiZuordnung[]>>({})
  const [produkteLaden, setProdukteLaden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entsperrt, setEntsperrt] = useState(false)
  const [formDateiIds, setFormDateiIds] = useState<string[]>([])

  const [typ, setTyp] = useState<string | null>(teil.typ)
  const [detail, setDetail] = useState<LfpDetailJson>(lfpRoh(teil))
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
  }, [teil.id])

  useEffect(() => {
    setEntsperrt(false)
  }, [teil.id])

  useEffect(() => {
    if (editingId !== null) return
    setTyp(teil.typ)
    const d = lfpRoh(teil)
    setDetail(d)
    detailR.current = d
    typR.current = teil.typ
  }, [teil, editingId])

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
        fehler('Datei-Zuordnungen konnten nicht geladen werden')
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
    [fehler],
  )

  const reloadProdukte = useCallback(async (): Promise<ProduktRow[]> => {
    if (!teil.id) {
      await ladeDateienFuerProdukte([])
      return []
    }
    setProdukteLaden(true)
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', teil.id)
      .eq('bereich', 'LFP')
      .order('sort_order')
    setProdukteLaden(false)
    if (error) {
      fehler('Produkte konnten nicht geladen werden')
      setProdukte([])
      await ladeDateienFuerProdukte([])
      return []
    }
    const rows = (data ?? []) as Database['public']['Tables']['teilauftrag_produkte']['Row'][]
    const mapped: ProduktRow[] = rows.map(r => ({
      id: r.id,
      teilauftrag_id: r.teilauftrag_id,
      bereich: r.bereich,
      detail: (r.detail ?? {}) as unknown as LfpDetailJson,
      sort_order: r.sort_order,
      erstellt_am: r.erstellt_am,
    }))
    setProdukte(mapped)
    await ladeDateienFuerProdukte(mapped)
    return mapped
  }, [teil.id, fehler, ladeDateienFuerProdukte])

  useEffect(() => {
    void reloadProdukte()
  }, [reloadProdukte])

  const dateiZuProduktZuordnen = useCallback(
    async (produktId: string, dateiId: string, produktRowsForReload?: ProduktRow[]) => {
      const reloadRows = produktRowsForReload ?? produkte
      if (produktDateien[produktId]?.some(z => z.dateiId === dateiId)) return
      const ins: Database['public']['Tables']['produkt_dateien']['Insert'] = {
        produkt_id: produktId,
        datei_id: dateiId,
      }
      const { error } = await supabase.from('produkt_dateien').insert(ins)
      if (error) {
        fehler('Datei konnte nicht zugeordnet werden')
        return
      }
      await ladeDateienFuerProdukte(reloadRows)
    },
    [produktDateien, fehler, produkte, ladeDateienFuerProdukte],
  )

  const dateiVonProduktEntfernen = useCallback(
    async (zuordnungId: string, produktRowsForReload?: ProduktRow[]) => {
      const { error } = await supabase.from('produkt_dateien').delete().eq('id', zuordnungId)
      if (error) {
        fehler('Zuordnung konnte nicht entfernt werden')
        return
      }
      await ladeDateienFuerProdukte(produktRowsForReload ?? produkte)
    },
    [fehler, produkte, ladeDateienFuerProdukte],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setFormDateiIds([])
    setTyp(teil.typ)
    const d = lfpRoh(teil)
    setDetail(d)
    detailR.current = d
    typR.current = teil.typ
  }, [teil])

  const lfpFehler = validateLfpDetail(typ, detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && lfpFehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (nextTyp: string | null, d: LfpDetailJson) => {
      setDetail(d)
      detailR.current = d
      setTyp(nextTyp)
      if (editingId !== null) return
      await onDetailPatch({ typ: nextTyp, detail: d })
    },
    [onDetailPatch, editingId]
  )

  const patchL = useCallback((p: LfpDetailJson) => {
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
    (d: LfpDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: lfpFehler, patchL, commit, speichDetail }

  const formOk = useMemo(() => Object.keys(lfpFehler).length === 0, [lfpFehler])

  const brauchtEntsperr =
    (teilStatus === 'PREPRESS_BEREIT' || teilStatus === 'PRODUKTION_BEREIT') && !entsperrt

  const handleAddOrSave = useCallback(async () => {
    const t = typR.current
    const d = { ...detailR.current }
    if (!t) return
    const errors = validateLfpDetail(t, d, teilStatus)
    if (Object.keys(errors).length > 0) return

    if (editingId) {
      const patch: Database['public']['Tables']['teilauftrag_produkte']['Update'] = {
        detail: { ...d, typ: t } as unknown as Json,
      }
      const { error } = await supabase.from('teilauftrag_produkte').update(patch).eq('id', editingId)
      if (error) {
        fehler('Produkt konnte nicht gespeichert werden')
        return
      }
      for (const z of [...(produktDateien[editingId] ?? [])]) {
        await dateiVonProduktEntfernen(z.zuordnungId)
      }
      let list = await reloadProdukte()
      for (const fid of formDateiIds) {
        await dateiZuProduktZuordnen(editingId, fid, list)
      }
      list = await reloadProdukte()
      await onDetailPatch({
        typ: teil.typ,
        detail: {
          ...lfpRoh(teil),
          hat_produkte: list.length > 0,
        } as LfpDetailJson,
      })
      resetForm()
      return
    }

    const ins: Database['public']['Tables']['teilauftrag_produkte']['Insert'] = {
      teilauftrag_id: teil.id,
      bereich: 'LFP',
      detail: { ...d, typ: t } as unknown as Json,
      sort_order: produkte.length,
    }
    const { data: insRow, error } = await supabase.from('teilauftrag_produkte').insert(ins).select('id').single()
    if (error) {
      fehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    const newId = insRow?.id != null ? String(insRow.id) : ''
    if (!newId) {
      fehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    let list = await reloadProdukte()
    for (const fid of formDateiIds) {
      await dateiZuProduktZuordnen(newId, fid, list)
    }
    list = await reloadProdukte()
    await onDetailPatch({
      typ: teil.typ,
      detail: {
        ...lfpRoh(teil),
        hat_produkte: list.length > 0,
      } as LfpDetailJson,
    })
    resetForm()
  }, [
    teil,
    teilStatus,
    editingId,
    produkte.length,
    produktDateien,
    formDateiIds,
    fehler,
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
        fehler('Produkt konnte nicht gelöscht werden')
        return
      }
      const list = await reloadProdukte()
      await onDetailPatch({
        typ: teil.typ,
        detail: {
          ...lfpRoh(teil),
          hat_produkte: list.length > 0,
        } as LfpDetailJson,
      })
      if (editingId === id) resetForm()
    },
    [fehler, reloadProdukte, editingId, resetForm, onDetailPatch, teil]
  )

  const handleEdit = useCallback((row: ProduktRow) => {
    setEditingId(row.id)
    setFormDateiIds(produktDateien[row.id]?.map(z => z.dateiId) ?? [])
    const raw = row.detail ?? {}
    const d = raw as Record<string, unknown>
    const tt = typeof d.typ === 'string' ? d.typ : null
    setTyp(tt)
    const dd = { ...(raw as LfpDetailJson) }
    setDetail(dd)
    detailR.current = dd
    typR.current = tt
  }, [produktDateien])

  return (
    <div className="ber-lfp td-bereich-sect">
      <div className="td-bereich-hd" aria-hidden>
        LFP
      </div>
      {typ === 'SONSTIGE_LFP' && (
        <p className="ber-hinweis">Bei „Sonstige LFP“ wird PREPRESS_BEREIT nur manuell gesetzt, nicht automatisch.</p>
      )}
      {typ === 'SCHILD_FOLIE' && detail.material === 'ACRYLGLAS' && (
        <p className="ber-hinweis">Bei Acrylglas: Rückseitenverklebung inkl., kein Zusatzfeld nötig.</p>
      )}

      <div className="ber-grid-2" style={{ marginTop: 4 }}>
        <BerZeile
          stack
          l="Typ"
          e={pruef && lfpFehler.typ ? lfpFehler.typ : undefined}
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
              {LFP_TEILTYPEN.map(x => (
                <option key={x} value={x}>
                  {LFP_TEILTYP_ANZEIGE[x]}
                </option>
              ))}
            </select>
          }
        />
        <NmbStueckzahl {...p} stack />
      </div>

      {typ === 'AUFKLEBER' && <Aufkleber {...p} />}
      {typ === 'SCHILD_UV' && <SchildUv {...p} />}
      {typ === 'SCHILD_FOLIE' && <SchildFolie {...p} />}
      {typ === 'FOLIENPLOTT' && <Folienplott {...p} />}
      {typ === 'BANNER' && <BannerF {...p} />}
      {typ === 'ROLLUP' && <RollupF {...p} />}
      {typ === 'FAHRZEUGBESCHRIFTUNG' && <FzB {...p} />}
      {typ === 'SONSTIGE_LFP' && <Sons {...p} />}

      {auftragDateien.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--color-border, #e5e7eb)',
          }}
        >
          <div className="ber-lbl" style={{ marginBottom: 6, display: 'block' }}>
            Dateien
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
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
                  {auftragDateien.find(df => df.id === fid)?.anzeigename ?? fid}
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
              {auftragDateien
                .filter(df => !formDateiIds.includes(df.id))
                .map(df => (
                  <option key={df.id} value={df.id}>
                    {df.anzeigename}
                  </option>
                ))}
            </select>
          </div>
        </div>
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
                    Format
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
                  const mat = pd.material ?? '—'
                  const fw = pd.format_breite
                  const fh = pd.format_hoehe
                  const fmt = fw && fh ? `${fw}×${fh} mm` : '—'
                  const typLabel = (LFP_TEILTYP_ANZEIGE as Record<string, string>)[pt] ?? pt
                  const zuo = produktDateien[r.id] ?? []
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {typLabel || '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {String(st || '—')}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{String(mat)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{fmt}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="cp-btn cp-btn-grau"
                            onClick={() => handleEdit(r)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            className="cp-btn cp-btn-rot"
                            onClick={() => void handleDelete(r.id)}
                          >
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
                                    auftragDateien.find(df => df.id === z.dateiId)?.anzeigename ?? z.dateiId,
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

function BerZeile({
  l,
  c,
  e,
  children,
  stack,
}: {
  l: string
  c?: ReactNode
  e?: string
  children?: ReactNode
  stack?: boolean
}) {
  const inhalt = c ?? children
  return (
    <div className={stack ? 'ber-zeile-stack' : 'ber-zeile'}>
      <span className="ber-lbl">{l}</span>
      <div>
        {inhalt}
        {e && <p className="ber-err">{e}</p>}
      </div>
    </div>
  )
}

function NmbStueckzahl(a: BlK & { stack?: boolean }) {
  const { d, fe, f, pruef, patchL, commit, stack } = a
  const val = d.stueckzahl
  const s = val === null || val === undefined ? '' : String(val)
  return (
    <BerZeile stack={stack} l="Stückzahl" e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('stueckzahl')}
        min={1}
        step={1}
        value={s}
        onChange={e => {
          const raw = e.target.value
          patchL({
            stueckzahl: raw === '' ? null : parseInt(raw, 10),
          } as LfpDetailJson)
        }}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function SelB(
  a: BlK & { k: string; l?: string; o: { v: string; t: string }[]; stack?: boolean },
) {
  const { k, o, d, fe, f, pruef, speichDetail, l: lb, stack } = a
  return (
    <BerZeile stack={stack} l={lb ?? k} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={String((d as Record<string, string>)[k] ?? '')}
        onChange={e => {
          const val = e.target.value
          speichDetail({ ...d, [k]: val } as LfpDetailJson)
        }}
      >
        <option value="">—</option>
        {o.map(x => (
          <option key={x.v} value={x.v}>
            {x.t}
          </option>
        ))}
      </select>
    </BerZeile>
  )
}

function boolSel(a: BlK & { k: string; l?: string }) {
  const { k, d, fe, f, pruef, speichDetail, l: lb } = a
  const v = (d as Record<string, unknown>)[k]
  const s = v === true ? 'true' : v === false ? 'false' : ''
  return (
    <BerZeile l={lb ?? k} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={s}
        onChange={e => {
          const t = e.target.value
          const b: true | false | undefined = t === 'true' ? true : t === 'false' ? false : undefined
          speichDetail({ ...d, [k]: b } as LfpDetailJson)
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
  a: BlK & { k: string; l: string; rows?: number },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, rows = 1 } = a
  const val = String((d as Record<string, string>)[k] ?? '')
  return (
    <BerZeile l={l} e={pruef ? f[k] : undefined}>
      {rows > 1 ? (
        <textarea
          className={'ber-inp ber-ta' + fe(k)}
          rows={rows}
          value={val}
          onChange={e => patchL({ [k]: e.target.value })}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fe(k)}
          value={val}
          onChange={e => patchL({ [k]: e.target.value })}
          onBlur={commit}
        />
      )}
    </BerZeile>
  )
}

function NmbInt(
  a: BlK & { k: string; l: string; suffix?: string; feKey?: string; min?: number },
) {
  const { k, l, d, fe, f, pruef, patchL, commit, suffix, feKey, min = 1 } = a
  const feK = feKey ?? k
  const val = (d as Record<string, number | null | string>)[k]
  const s = val === null || val === undefined ? '' : String(val)
  return (
    <BerZeile l={l} e={pruef ? f[feK] : undefined}>
      <div className="ber-nmb">
        <input
          type="number"
          className={'ber-inp' + fe(feK)}
          min={min}
          step={1}
          value={s}
          onChange={e => {
            const raw = e.target.value
            const n = raw === '' ? null : parseInt(raw, 10)
            patchL({ [k]: Number.isNaN(n as number) ? null : n } as LfpDetailJson)
          }}
          onBlur={commit}
        />
        {suffix && <span className="ber-suf">{suffix}</span>}
      </div>
    </BerZeile>
  )
}

/** Breite/Höhe: mindestens eines &gt; 0 – gemeinsame Fehlermeldung format_masse */
function MasseHoeheBreite(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const msg = pruef ? f.format_masse : undefined
  const b = d.format_breite
  const h = d.format_hoehe
  const sb = b === null || b === undefined ? '' : String(b)
  const sh = h === null || h === undefined ? '' : String(h)
  return (
    <div>
      <div className="ber-grid-2">
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Format Breite (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fe('format_masse')}
              min={0.01}
              step={0.01}
              value={sb}
              onChange={e => {
                const raw = e.target.value
                patchL({
                  format_breite: raw === '' ? null : parseFloat(raw),
                } as LfpDetailJson)
              }}
              onBlur={commit}
            />
          </div>
        </div>
        <div className="ber-zeile-stack">
          <span className="ber-lbl">Format Höhe (mm)</span>
          <div>
            <input
              type="number"
              className={'ber-inp' + fe('format_masse')}
              min={0.01}
              step={0.01}
              value={sh}
              onChange={e => {
                const raw = e.target.value
                patchL({
                  format_hoehe: raw === '' ? null : parseFloat(raw),
                } as LfpDetailJson)
              }}
              onBlur={commit}
            />
          </div>
        </div>
      </div>
      {msg && <p className="ber-err ber-err--mass">{msg}</p>}
    </div>
  )
}

function Dat(a: BlK & { k: string; l: string }) {
  const { k, l, d, fe, f, pruef, patchL, commit } = a
  const v = (d as Record<string, string>)[k] ?? ''
  const iso = v ? (v.length > 10 ? v.slice(0, 10) : v) : ''
  return (
    <BerZeile l={l} e={pruef ? f[k] : undefined}>
      <DateInput
        className={'ber-inp' + fe(k)}
        value={iso}
        onChange={e => patchL({ [k]: e.target.value })}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function BesonderheitenUnten(p: BlK) {
  return <Txt {...p} k="besonderheiten" l="Besonderheiten" rows={3} />
}

function Aufkleber(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  return (
    <>
      <div className="ber-grid-2">
        <BerZeile stack l="Material" e={pruef ? f.material : undefined}>
          <select
            className={'ber-inp' + fe('material')}
            value={String((d as Record<string, string>).material ?? '')}
            onChange={e => {
              const v = e.target.value
              const next: LfpDetailJson = { ...d, material: v }
              if (v !== '3551') next.material_3551_variante = null
              speichDetail(next)
            }}
          >
            <option value="">—</option>
            {LFP_AUFKLEBER_MATERIALIEN.map(x => (
              <option key={x.wert} value={x.wert}>
                {x.anzeige}
              </option>
            ))}
          </select>
        </BerZeile>
        <SelB
          {...p}
          stack
          k="konturschnitt"
          l="Konturschnitt"
          o={[
            { v: 'FREIFORM', t: 'Freiform' },
            { v: 'RECHTECK', t: 'Rechteck' },
          ]}
        />
      </div>
      {p.d.material === '3551' && (
        <div className="ber-col-voll" style={{ marginBottom: 6 }}>
          <BerZeile stack l="3551 Variante">
            <select
              className="ber-inp"
              value={String((d as Record<string, string | null>).material_3551_variante ?? '')}
              onChange={e =>
                speichDetail({
                  ...d,
                  material_3551_variante: e.target.value || null,
                } as LfpDetailJson)
              }
            >
              {LFP_3551_VARIANTEN.map(x => (
                <option key={String(x.wert)} value={String(x.wert ?? '')}>
                  {x.anzeige}
                </option>
              ))}
            </select>
          </BerZeile>
        </div>
      )}
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="laminat"
          l="Laminat"
          o={[
            { v: 'NEIN', t: 'Nein' },
            { v: 'MATT', t: 'Matt' },
            { v: 'GLAENZEND', t: 'Glänzend' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="ausgabe"
          l="Ausgabe"
          o={[
            { v: 'EINZEL', t: 'Einzel' },
            { v: 'BOGEN', t: 'Bogen' },
          ]}
        />
      </div>
      <MasseHoeheBreite {...p} />
      <BesonderheitenUnten {...p} />
    </>
  )
}

function SchildUv(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={[
            { v: 'ALUVERBUND', t: 'Alu-Verbund' },
            { v: 'PVC', t: 'PVC' },
            { v: 'ACRYLGLAS', t: 'Acrylglas' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="druckseite"
          l="Druckseite"
          o={[
            { v: 'EINSEITIG', t: 'Einseitig' },
            { v: 'BEIDSEITIG', t: 'Beidseitig' },
          ]}
        />
      </div>
      {p.d.material === 'ACRYLGLAS' && (
        <SelB
          {...p}
          k="acryl_druckrichtung"
          l="Acryl Druckrichtung"
          o={[
            { v: 'VORDERSEITE', t: 'Vorderseite' },
            { v: 'RUECKSEITE', t: 'Rückseite' },
          ]}
        />
      )}
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {boolSel({ ...p, k: 'bohrungen', l: 'Bohrungen' })}
      {p.d.bohrungen === true && (
        <>
          <NmbInt {...p} k="bohrungen_durchmesser" l="Bohrungen Ø (mm)" feKey="bohrungen_durchmesser" min={1} />
          <Txt {...p} k="bohrungen_position" l="Bohrungen Position" />
        </>
      )}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function SchildFolie(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={[
            { v: 'ALUVERBUND', t: 'Alu-Verbund' },
            { v: 'PVC', t: 'PVC' },
            { v: 'ACRYLGLAS', t: 'Acrylglas' },
          ]}
        />
        <SelB
          {...p}
          stack
          k="druckseite"
          l="Druckseite"
          o={[
            { v: 'EINSEITIG', t: 'Einseitig' },
            { v: 'BEIDSEITIG', t: 'Beidseitig' },
          ]}
        />
      </div>
      <div style={{ maxWidth: '20rem' }}>
        <SelB
          {...p}
          stack
          k="laminat"
          l="Laminat"
          o={[
            { v: 'NEIN', t: 'Nein' },
            { v: 'MATT', t: 'Matt' },
            { v: 'GLAENZEND', t: 'Glänzend' },
          ]}
        />
      </div>
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'ecken_runden', l: 'Ecken runden' })}
      {boolSel({ ...p, k: 'bohrungen', l: 'Bohrungen' })}
      {p.d.bohrungen === true && (
        <>
          <NmbInt {...p} k="bohrungen_durchmesser" l="Bohrungen Ø (mm)" feKey="bohrungen_durchmesser" min={1} />
          <Txt {...p} k="bohrungen_position" l="Bohrungen Position" />
        </>
      )}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function Folienplott(p: BlK) {
  return (
    <>
      <div className="ber-grid-2">
        <SelB
          {...p}
          stack
          k="material"
          l="Material"
          o={LFP_FOLIENPLOTT_MATERIALIEN.map(x => ({ v: x.wert, t: x.anzeige }))}
        />
        <SelB
          {...p}
          stack
          k="ausgabe"
          l="Ausgabe"
          o={[
            { v: 'EINZEL', t: 'Einzel' },
            { v: 'BOGEN', t: 'Bogen' },
          ]}
        />
      </div>
      <BesonderheitenUnten {...p} />
    </>
  )
}

function BannerF(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  return (
    <>
      <BerZeile l="Material" e={pruef ? f.material : undefined}>
        <select
          className={'ber-inp' + fe('material')}
          value={String(d.material ?? '')}
          onChange={e => {
            const v = e.target.value
            if (v === 'BAUZAUNBANNER') {
              speichDetail({
                ...d,
                material: 'BAUZAUNBANNER',
                format_hoehe: 1730,
                format_breite: 3400,
                saum: true,
                oesen: true,
              })
            } else {
              speichDetail({ ...d, material: v })
            }
          }}
        >
          <option value="">—</option>
          {['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].map(m => {
            const t =
              m === 'PVC_FRONTLIT' ? 'PVC Frontlit' : m === 'MESH' ? 'Mesh' : 'Bauzaunbanner'
            return (
              <option key={m} value={m}>
                {t}
              </option>
            )
          })}
        </select>
      </BerZeile>
      <MasseHoeheBreite {...p} />
      {boolSel({ ...p, k: 'saum', l: 'Saum' })}
      {p.d.saum === true && <Txt {...p} k="saum_seiten" l="Saum (Seiten)" />}
      {boolSel({ ...p, k: 'oesen', l: 'Ösen' })}
      {p.d.oesen === true && <Txt {...p} k="oesen_detail" l="Ösen Detail" />}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function RollupF(p: BlK) {
  const br = (p.d as Record<string, number>).breite
  return (
    <>
      <SelB
        {...p}
        k="material"
        l="Material"
        o={[
          { v: 'PVC_FRONTLIT', t: 'PVC Frontlit' },
          { v: 'ROLLUP_FILM', t: 'Rollup-Film' },
        ]}
      />
      <SelB
        {...p}
        k="system"
        l="System"
        o={[
          { v: 'NEUE_KASSETTE', t: 'Neue Kassette' },
          { v: 'MOTIVTAUSCH', t: 'Motivtausch' },
        ]}
      />
      <BerZeile l="Breite" e={p.pruef ? p.f.breite : undefined}>
        <select
          className={'ber-inp' + p.fe('breite')}
          value={br === 85 || br === 100 ? String(br) : ''}
          onChange={e => {
            const n = e.target.value === '' ? null : parseInt(e.target.value, 10)
            p.speichDetail({ ...p.d, breite: n } as LfpDetailJson)
          }}
        >
          <option value="">—</option>
          <option value="85">85 cm</option>
          <option value="100">100 cm</option>
        </select>
      </BerZeile>
      <BesonderheitenUnten {...p} />
    </>
  )
}

function FzB(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  return (
    <>
      <Txt {...p} k="marke" l="Marke" />
      <Txt {...p} k="modell" l="Modell" />
      {boolSel({ ...p, k: 'bereiche_seiten', l: 'Bereich Seiten' })}
      {boolSel({ ...p, k: 'bereiche_front', l: 'Bereich Front' })}
      {boolSel({ ...p, k: 'bereiche_heck', l: 'Bereich Heck' })}
      <BerZeile l="Montage" e={pruef ? f.montage : undefined}>
        <select
          className={'ber-inp' + fe('montage')}
          value={String((d as Record<string, string>).montage ?? '')}
          onChange={e => {
            const v = e.target.value
            if (v === 'OHNE') {
              speichDetail({
                ...d,
                montage: 'OHNE',
                montagetermin: null,
                altbeklebung: null,
              } as LfpDetailJson)
            } else {
              speichDetail({ ...d, montage: v } as LfpDetailJson)
            }
          }}
        >
          <option value="">—</option>
          <option value="MIT">Mit</option>
          <option value="OHNE">Ohne</option>
        </select>
      </BerZeile>
      {d.montage === 'MIT' && boolSel({ ...p, k: 'altbeklebung', l: 'Altbeklebung' })}
      {d.montage === 'MIT' && <Dat {...p} k="montagetermin" l="Montagetermin" />}
      <Txt {...p} k="besonderheiten" l="Besonderheiten" rows={3} />
    </>
  )
}

function Sons(p: BlK) {
  return <Txt {...p} k="beschreibung" l="Beschreibung" rows={6} />
}
