import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabase'
import { COPY_SHOP_TYPS, COPY_SHOP_TYPS_ANZEIGE, type CopyShopDetailJson } from '../../types/copyshop'
import { BROS_DIN, FALZ_DIN, KARTE_DIN, KARTE_FORMAT_ORDER, FALZ_FORMAT_ORDER, BROSCH_FORMAT_ORDER } from '../../lib/copyshop/dinKfbFormate'
import { validateCopyShopDetail } from '../../lib/copyshop/validateCopyShopDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import type { Datei } from '../DateiListe'
import { useToast } from '../Toast'
import { MaterialCC } from './copyshop/MaterialCC'
import { MaterialOffset } from './copyshop/MaterialOffset'
import {
  AUSDRUCK_MATERIALIEN,
  BINDUNG_MATERIALIEN,
  MULTILOFT_FARBKERNE,
  POSTER_MATERIALIEN,
  VISITENKARTE_MATERIALIEN,
} from '../../config/materialien'
import '../WorkArea.css'

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: CopyShopDetailJson | null }) => Promise<void>
  auftragDateien?: Datei[]
}

type ProduktRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: CopyShopDetailJson
  sort_order: number | null
  erstellt_am: string | null
}

/** `datei_id` gehört nicht ins Produkt-JSON — Zuordnung nur über `produkt_dateien`. */
function detailOhneDateiId(d: CopyShopDetailJson): CopyShopDetailJson {
  const o = { ...d } as Record<string, unknown>
  delete o.datei_id
  return o as CopyShopDetailJson
}

function copyRoh(teil: TeilauftragRow): CopyShopDetailJson {
  const d = teil.detail
  const base = d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
  return detailOhneDateiId(base)
}

/** PLAKAT: DIN-Hochformat, Breite × Höhe (mm) */
const PLAKAT_DIN: Record<'A0' | 'A1' | 'A2' | 'A3' | 'A4', { b: number; h: number }> = {
  A4: { b: 210, h: 297 },
  A3: { b: 297, h: 420 },
  A2: { b: 420, h: 594 },
  A1: { b: 594, h: 841 },
  A0: { b: 841, h: 1189 },
}

const PLAKAT_DEFAULT: CopyShopDetailJson = {
  format: 'A1',
  format_breite: 594,
  format_hoehe: 841,
}

const KARTE_FALZ_MAT_NULL: CopyShopDetailJson = {
  material_cc: null,
  material_cc_sonstige: null,
  offset_art: null,
  offset_grammatur: null,
  offset_oberflaeche: null,
  spezial_papier: null,
  spezial_sonstige: null,
  kaschierung: null,
  kaschierung_seiten: null,
  recycling_grammatur: null,
}

const BROSCH_MAT_NULL: CopyShopDetailJson = {
  ...KARTE_FALZ_MAT_NULL,
  cc_umschlag: null,
  cc_umschlag_sonstige: null,
  cc_inhalt: null,
  cc_inhalt_sonstige: null,
  brosch_bindung: null,
  brosch_u_gramm: null,
  brosch_u_ober: null,
  brosch_i_gramm: null,
  brosch_i_ober: null,
}

type BlK = {
  d: CopyShopDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: CopyShopDetailJson) => void
  commit: () => void
  speichDetail: (d: CopyShopDetailJson) => void
}

type ProduktDateiZuordnung = { zuordnungId: string; dateiId: string }

export function CopyShopDetail({
  teil,
  teilStatus,
  onDetailPatch,
  auftragDateien = [],
}: Props) {
  const { fehler: toastFehler } = useToast()

  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [produktDateien, setProduktDateien] = useState<Record<string, ProduktDateiZuordnung[]>>({})
  const [produkteLaden, setProdukteLaden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entsperrt, setEntsperrt] = useState(false)
  const [dateiSelectProduktId, setDateiSelectProduktId] = useState<string | null>(null)

  const [typ, setTyp] = useState<string | null>(teil.typ)
  const [detail, setDetail] = useState<CopyShopDetailJson>(copyRoh(teil))
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
  }, [teil.id])

  useEffect(() => {
    setEntsperrt(false)
  }, [teil.id])

  useEffect(() => {
    if (editingId !== null) return
    setTyp(teil.typ)
    const d = copyRoh(teil)
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
    if (!teil.id) {
      await ladeDateienFuerProdukte([])
      return []
    }
    setProdukteLaden(true)
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', teil.id)
      .eq('bereich', 'COPYSHOP')
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
      detail: detailOhneDateiId((r.detail ?? {}) as unknown as CopyShopDetailJson),
      sort_order: r.sort_order,
      erstellt_am: r.erstellt_am,
    }))
    setProdukte(mapped)
    await ladeDateienFuerProdukte(mapped)
    return mapped
  }, [teil.id, toastFehler, ladeDateienFuerProdukte])

  useEffect(() => {
    void reloadProdukte()
  }, [reloadProdukte])

  const dateiZuProduktZuordnen = useCallback(
    async (produktId: string, dateiId: string) => {
      if (produktDateien[produktId]?.some(z => z.dateiId === dateiId)) return
      const ins: Database['public']['Tables']['produkt_dateien']['Insert'] = {
        produkt_id: produktId,
        datei_id: dateiId,
      }
      const { error } = await supabase.from('produkt_dateien').insert(ins)
      if (error) {
        toastFehler('Datei konnte nicht zugeordnet werden')
        return
      }
      await ladeDateienFuerProdukte(produkte)
    },
    [produktDateien, toastFehler, produkte, ladeDateienFuerProdukte],
  )

  const dateiVonProduktEntfernen = useCallback(
    async (zuordnungId: string) => {
      const { error } = await supabase.from('produkt_dateien').delete().eq('id', zuordnungId)
      if (error) {
        toastFehler('Zuordnung konnte nicht entfernt werden')
        return
      }
      await ladeDateienFuerProdukte(produkte)
    },
    [toastFehler, produkte, ladeDateienFuerProdukte],
  )

  const resetForm = useCallback(() => {
    setEditingId(null)
    setTyp(teil.typ)
    const d = copyRoh(teil)
    setDetail(d)
    detailR.current = d
    typR.current = teil.typ
  }, [teil])

  const hatDateiFuerValidierung =
    editingId === null ? undefined : (produktDateien[editingId]?.length ?? 0) > 0
  const copyErr = validateCopyShopDetail(typ, detail, teilStatus, hatDateiFuerValidierung)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && copyErr[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (nextTyp: string | null, d: CopyShopDetailJson) => {
      const clean = detailOhneDateiId(d)
      setDetail(clean)
      detailR.current = clean
      setTyp(nextTyp)
      if (editingId !== null) return
      await onDetailPatch({ typ: nextTyp, detail: clean })
    },
    [onDetailPatch, editingId]
  )

  const patchL = useCallback((p: CopyShopDetailJson) => {
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
    (d: CopyShopDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(typR.current, d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: copyErr, patchL, commit, speichDetail }

  const formOk = useMemo(() => Object.keys(copyErr).length === 0, [copyErr])

  const brauchtEntsperr =
    (teilStatus === 'PREPRESS_BEREIT' || teilStatus === 'PRODUKTION_BEREIT') && !entsperrt

  const handleAddOrSave = useCallback(async () => {
    const t = typR.current
    const d = detailOhneDateiId({ ...detailR.current })
    if (!t) return
    const hatDatei =
      editingId === null ? undefined : (produktDateien[editingId]?.length ?? 0) > 0
    const errors = validateCopyShopDetail(t, d, teilStatus, hatDatei)
    if (Object.keys(errors).length > 0) return

    if (editingId) {
      const patch: Database['public']['Tables']['teilauftrag_produkte']['Update'] = {
        detail: { ...d, typ: t } as unknown as Json,
      }
      const { error } = await supabase.from('teilauftrag_produkte').update(patch).eq('id', editingId)
      if (error) {
        toastFehler('Produkt konnte nicht gespeichert werden')
        return
      }
      const list = await reloadProdukte()
      await onDetailPatch({
        typ: teil.typ,
        detail: {
          ...copyRoh(teil),
          hat_produkte: list.length > 0,
        } as CopyShopDetailJson,
      })
      resetForm()
      return
    }

    const ins: Database['public']['Tables']['teilauftrag_produkte']['Insert'] = {
      teilauftrag_id: teil.id,
      bereich: 'COPYSHOP',
      detail: { ...d, typ: t } as unknown as Json,
      sort_order: produkte.length,
    }
    const { error } = await supabase.from('teilauftrag_produkte').insert(ins)
    if (error) {
      toastFehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    const list = await reloadProdukte()
    await onDetailPatch({
      typ: teil.typ,
      detail: {
        ...copyRoh(teil),
        hat_produkte: list.length > 0,
      } as CopyShopDetailJson,
    })
    resetForm()
  }, [
    teil,
    teilStatus,
    editingId,
    produkte.length,
    produktDateien,
    toastFehler,
    reloadProdukte,
    resetForm,
    onDetailPatch,
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
        typ: teil.typ,
        detail: {
          ...copyRoh(teil),
          hat_produkte: list.length > 0,
        } as CopyShopDetailJson,
      })
      if (editingId === id) resetForm()
    },
    [toastFehler, reloadProdukte, editingId, resetForm, onDetailPatch, teil]
  )

  const handleEdit = useCallback((row: ProduktRow) => {
    setEditingId(row.id)
    const raw = row.detail ?? {}
    const dr = raw as Record<string, unknown>
    const tt = typeof dr.typ === 'string' ? dr.typ : null
    setTyp(tt)
    const dd = detailOhneDateiId({ ...(raw as CopyShopDetailJson) })
    setDetail(dd)
    detailR.current = dd
    typR.current = tt
  }, [])

  useEffect(() => {
    if (typ !== 'BINDUNG') return
    const d0 = detailR.current
    const r = d0 as Record<string, string | number | null | boolean | undefined>
    const ba = String(r.bindungsart ?? '')
    if (ba === 'SOFTCOVER' || ba === 'HARDCOVER') {
      if (r.format === 'A4_HOCH') {
        speichDetail({
          ...d0,
          format: 'A4',
          orientierung: 'HOCHFORMAT',
          format_breite: 210,
          format_hoehe: 297,
        } as CopyShopDetailJson)
        return
      }
      if (
        r.format !== 'A4' ||
        r.orientierung !== 'HOCHFORMAT' ||
        r.format_breite !== 210 ||
        r.format_hoehe !== 297
      ) {
        speichDetail({
          ...d0,
          format: 'A4',
          orientierung: 'HOCHFORMAT',
          format_breite: 210,
          format_hoehe: 297,
        } as CopyShopDetailJson)
      }
    } else if (ba === 'WIRE_O' || ba === 'KUNSTSTOFFSPIRALE') {
      const ffmt = String(r.format ?? '')
      const mapLeg: Record<string, { format: string; orientierung: string }> = {
        A5_HOCH: { format: 'A5', orientierung: 'HOCHFORMAT' },
        A4_HOCH: { format: 'A4', orientierung: 'HOCHFORMAT' },
        A3_QUER: { format: 'A3', orientierung: 'QUERFORMAT' },
      }
      if (ffmt in mapLeg) {
        const m = mapLeg[ffmt]!
        speichDetail({ ...d0, format: m.format, orientierung: m.orientierung } as CopyShopDetailJson)
        return
      }
      if (ffmt === 'A3' && r.orientierung !== 'QUERFORMAT') {
        speichDetail({ ...d0, orientierung: 'QUERFORMAT' } as CopyShopDetailJson)
      }
    }
  }, [typ, teil.id, teil.detail, speichDetail])

  useEffect(() => {
    if (typ !== 'PLAKAT_POSTER') return
    const d0 = detailR.current
    const f = String((d0 as Record<string, string>).format ?? '').trim()
    if (!f) {
      speichDetail({ ...d0, ...PLAKAT_DEFAULT } as CopyShopDetailJson)
      return
    }
    if (f !== 'FREI' && f in PLAKAT_DIN) {
      const dim = PLAKAT_DIN[f as keyof typeof PLAKAT_DIN]
      const b = d0.format_breite
      const h = d0.format_hoehe
      if (b !== dim.b || h !== dim.h) {
        speichDetail({ ...d0, format: f, format_breite: dim.b, format_hoehe: dim.h } as CopyShopDetailJson)
      }
    }
  }, [typ, teil.id, teil.detail, speichDetail])

  useEffect(() => {
    if (typ === 'KARTE_FLYER') {
      const d0 = detailR.current
      const fmt = String((d0 as Record<string, string>).format ?? '').trim()
      if (fmt && fmt !== 'FREI' && fmt in KARTE_DIN) {
        const dim = KARTE_DIN[fmt as keyof typeof KARTE_DIN]
        if (d0.format_breite !== dim.b || d0.format_hoehe !== dim.h) {
          speichDetail({ ...d0, format: fmt, format_breite: dim.b, format_hoehe: dim.h } as CopyShopDetailJson)
        }
      }
    } else if (typ === 'FALZFLYER') {
      const d0 = detailR.current
      const fmt = String((d0 as Record<string, string>).format ?? '').trim()
      if (fmt && fmt !== 'FREI' && fmt in FALZ_DIN) {
        const dim = FALZ_DIN[fmt as keyof typeof FALZ_DIN]
        if (d0.format_breite !== dim.b || d0.format_hoehe !== dim.h) {
          speichDetail({ ...d0, format: fmt, format_breite: dim.b, format_hoehe: dim.h } as CopyShopDetailJson)
        }
      }
    } else if (typ === 'BROSCHUERE') {
      const d0 = detailR.current
      const fmt = String((d0 as Record<string, string>).format ?? '').trim()
      if (fmt && fmt !== 'FREI' && fmt in BROS_DIN) {
        const dim = BROS_DIN[fmt as keyof typeof BROS_DIN]
        if (d0.format_breite !== dim.b || d0.format_hoehe !== dim.h) {
          speichDetail({ ...d0, format: fmt, format_breite: dim.b, format_hoehe: dim.h } as CopyShopDetailJson)
        }
      }
      if (String(d0.produktionsweg) === 'CC' && d0.brosch_bindung !== 'DRAHTHEFTUNG') {
        speichDetail({ ...d0, brosch_bindung: 'DRAHTHEFTUNG' } as CopyShopDetailJson)
      }
    }
  }, [typ, teil.id, teil.detail, speichDetail])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Copy-Shop-Details</h3>

      <BerZeile
        l="Typ"
        e={pruef && copyErr.typ ? copyErr.typ : undefined}
        c={
          <select
            className={'ber-inp' + fe('typ')}
            value={typ ?? ''}
            onChange={e => {
              const v = e.target.value
              if (v !== (typ ?? '')) {
                if (v === 'PLAKAT_POSTER') {
                  setTyp('PLAKAT_POSTER')
                  setDetail(PLAKAT_DEFAULT)
                  detailR.current = PLAKAT_DEFAULT
                  typR.current = 'PLAKAT_POSTER'
                  if (editingId === null) void speich('PLAKAT_POSTER', { ...PLAKAT_DEFAULT } as CopyShopDetailJson)
                } else {
                  setTyp(v || null)
                  setDetail({})
                  detailR.current = {}
                  typR.current = v || null
                  if (editingId === null) void speich(v || null, {})
                }
              } else {
                setTyp(v || null)
                typR.current = v || null
              }
            }}
          >
            <option value="">—</option>
            {COPY_SHOP_TYPS.map(x => (
              <option key={x} value={x}>
                {COPY_SHOP_TYPS_ANZEIGE[x]}
              </option>
            ))}
          </select>
        }
      />

      <NmbStueckzahl {...p} />
      {typ &&
        typ !== 'PLAKAT_POSTER' &&
        typ !== 'AUSDRUCK' &&
        typ !== 'KARTE_FLYER' &&
        typ !== 'FALZFLYER' &&
        typ !== 'BROSCHUERE' &&
        typ !== 'VISITENKARTE' &&
        typ !== 'BINDUNG' && <ProduktionswegSel {...p} />}

      {typ === 'PLAKAT_POSTER' && <PlakatPoster {...p} />}
      {typ === 'KARTE_FLYER' && <KarteFlyer {...p} />}
      {typ === 'FALZFLYER' && <Falzflyer {...p} />}
      {typ === 'BROSCHUERE' && <Broschuere {...p} />}
      {typ === 'VISITENKARTE' && <Visitenkarte {...p} />}
      {typ === 'BINDUNG' && <BindungF {...p} />}
      {typ === 'AUSDRUCK' && <AusdruckF {...p} />}

      {pruef && copyErr.datei && (
        <div
          role="alert"
          style={{ color: 'var(--color-danger, #b91c1c)', fontSize: 13, marginTop: 6 }}
        >
          {copyErr.datei}
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
                    Prod.-Weg / Material
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
                  const pwg = pd.produktionsweg != null ? String(pd.produktionsweg) : ''
                  const mat = pd.material != null ? String(pd.material) : ''
                  const kurz = pwg || mat || '—'
                  const fw = pd.format_breite
                  const fh = pd.format_hoehe
                  const fmt = fw && fh ? `${fw}×${fh} mm` : '—'
                  const typLabel =
                    (COPY_SHOP_TYPS_ANZEIGE as Record<string, string>)[pt] ?? pt
                  const zuo = produktDateien[r.id] ?? []
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {typLabel || '—'}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {String(st || '—')}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{kurz}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{fmt}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="cp-btn cp-btn-grau" onClick={() => handleEdit(r)}>
                              Bearbeiten
                            </button>
                            <button type="button" className="cp-btn cp-btn-rot" onClick={() => void handleDelete(r.id)}>
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: '4px 8px 10px',
                            borderBottom: '1px solid #f3f4f6',
                            background: 'var(--color-muted-bg, #fafafa)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              alignItems: 'center',
                              fontSize: 12,
                            }}
                          >
                            {zuo.map(z => (
                              <span
                                key={z.zuordnungId}
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
                                  {auftragDateien.find(d => d.id === z.dateiId)?.anzeigename ?? z.dateiId}
                                </span>
                                <button
                                  type="button"
                                  className="cp-btn cp-btn-grau"
                                  style={{ minWidth: 22, padding: '0 6px', fontSize: 14, lineHeight: 1 }}
                                  title="Zuordnung entfernen"
                                  onClick={() => void dateiVonProduktEntfernen(z.zuordnungId)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              className="cp-btn cp-btn-grau"
                              style={{ fontSize: 12, padding: '2px 10px' }}
                              onClick={() =>
                                setDateiSelectProduktId(cur => (cur === r.id ? null : r.id))
                              }
                            >
                              Datei zuordnen
                            </button>
                            {dateiSelectProduktId === r.id && (
                              <select
                                className="ber-inp"
                                style={{ fontSize: 12, maxWidth: 240 }}
                                value=""
                                onChange={e => {
                                  const v = e.target.value
                                  if (v) {
                                    void dateiZuProduktZuordnen(r.id, v)
                                    setDateiSelectProduktId(null)
                                  }
                                }}
                              >
                                <option value="">Datei wählen…</option>
                                {auftragDateien
                                  .filter(d => !zuo.some(z => z.dateiId === d.id))
                                  .map(d => (
                                    <option key={d.id} value={d.id}>
                                      {d.anzeigename}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
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
  const val = d.stueckzahl
  const s = val === null || val === undefined ? '' : String(val)
  return (
    <BerZeile l="Stückzahl" e={pruef && f.stueckzahl ? f.stueckzahl : undefined}>
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
          } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function ProduktionswegSel(a: BlK) {
  const { d, fe, f, pruef, speichDetail } = a
  const v = (d.produktionsweg as string | null | undefined) ?? ''
  return (
    <BerZeile l="Produktionsweg" e={pruef && f.produktionsweg ? f.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fe('produktionsweg')}
        value={v}
        onChange={e => {
          const x = e.target.value
          speichDetail({ ...d, produktionsweg: x === '' ? null : x } as CopyShopDetailJson)
        }}
      >
        <option value="">—</option>
        <option value="COPYSHOP">Copy-Shop</option>
        <option value="OFFSET">Offset</option>
      </select>
    </BerZeile>
  )
}

function SelB(
  a: BlK & { k: string; l?: string; o: { v: string; t: string }[] },
) {
  const { k, o, d, fe, f, pruef, speichDetail, l: lb } = a
  return (
    <BerZeile l={lb ?? k} e={pruef ? f[k] : undefined}>
      <select
        className={'ber-inp' + fe(k)}
        value={String((d as Record<string, string>)[k] ?? '')}
        onChange={e =>
          speichDetail({ ...d, [k]: e.target.value } as CopyShopDetailJson)
        }
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
          speichDetail({ ...d, [k]: b } as CopyShopDetailJson)
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
          onChange={e => patchL({ [k]: e.target.value } as CopyShopDetailJson)}
          onBlur={commit}
        />
      ) : (
        <input
          type="text"
          className={'ber-inp' + fe(k)}
          value={val}
          onChange={e => patchL({ [k]: e.target.value } as CopyShopDetailJson)}
          onBlur={commit}
        />
      )}
    </BerZeile>
  )
}

function MasseHoeheBreite(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const msg = pruef ? f.format_masse : undefined
  const b = d.format_breite
  const h = d.format_hoehe
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
            min={0.01}
            step={0.01}
            value={sb}
            onChange={e => {
              const raw = e.target.value
              patchL({
                format_breite: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
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
            min={0.01}
            step={0.01}
            value={sh}
            onChange={e => {
              const raw = e.target.value
              patchL({
                format_hoehe: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
            }}
            onBlur={commit}
          />
        </div>
      </div>
      {msg && <p className="ber-err ber-err--mass">{msg}</p>}
    </div>
  )
}

function BesonderheitenUnten(p: BlK) {
  return <Txt {...p} k="besonderheiten" l="Besonderheiten" rows={3} />
}

function PlakatPoster(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  const fmt = String((d as Record<string, string>).format ?? '')
  return (
    <>
      <BerZeile l="Format" e={pruef && f.format ? f.format : undefined}>
        <select
          className={'ber-inp' + fe('format')}
          value={fmt}
          onChange={e => {
            const v = e.target.value
            if (v === 'FREI') {
              speichDetail({ ...d, format: 'FREI' } as CopyShopDetailJson)
            } else if (v in PLAKAT_DIN) {
              const dim = PLAKAT_DIN[v as keyof typeof PLAKAT_DIN]
              speichDetail({
                ...d,
                format: v,
                format_breite: dim.b,
                format_hoehe: dim.h,
              } as CopyShopDetailJson)
            } else {
              speichDetail({ ...d, format: v || null } as CopyShopDetailJson)
            }
          }}
        >
          <option value="">—</option>
          {(['A4', 'A3', 'A2', 'A1', 'A0'] as const).map(x => {
            const dim = PLAKAT_DIN[x]
            return (
              <option key={x} value={x}>
                {x} ({dim.b}×{dim.h} mm)
              </option>
            )
          })}
          <option value="FREI">Frei</option>
        </select>
      </BerZeile>
      <SelB
        {...p}
        k="material"
        l="Material"
        o={POSTER_MATERIALIEN.map(x => ({ v: x.wert, t: x.anzeige }))}
      />
      <SelB
        {...p}
        k="laminat"
        l="Laminat"
        o={[
          { v: 'NEIN', t: 'Nein' },
          { v: 'MATT', t: 'Matt' },
          { v: 'GLAENZEND', t: 'Glänzend' },
        ]}
      />
      {fmt === 'FREI' && <MasseHoeheBreite {...p} />}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function KfbFormatFeld(q: {
  blk: BlK
  din: Record<string, { b: number; h: number }>
  order: readonly string[]
}) {
  const { blk, din, order } = q
  const { d, fe, f, pruef, speichDetail } = blk
  const fmt = String((d as Record<string, string>).format ?? '')
  return (
    <BerZeile l="Format" e={pruef && f.format ? f.format : undefined}>
      <select
        className={'ber-inp' + fe('format')}
        value={fmt}
        onChange={e => {
          const v = e.target.value
          if (v === 'FREI') speichDetail({ ...d, format: 'FREI' } as CopyShopDetailJson)
          else if (v in din) {
            const dim = din[v]!
            speichDetail({
              ...d,
              format: v,
              format_breite: dim.b,
              format_hoehe: dim.h,
            } as CopyShopDetailJson)
          } else {
            speichDetail({ ...d, format: v || null } as CopyShopDetailJson)
          }
        }}
      >
        <option value="">—</option>
        {order.map(k => {
          if (k === 'FREI') {
            return (
              <option key="FREI" value="FREI">
                Frei
              </option>
            )
          }
          const dim = din[k]
          if (!dim) return null
          return (
            <option key={k} value={k}>
              {k} ({dim.b}×{dim.h} mm)
            </option>
          )
        })}
      </select>
    </BerZeile>
  )
}

function KfbPwgKarteFalz({ blk }: { blk: BlK }) {
  const { d, fe, f, pruef, speichDetail } = blk
  const v = String((d as Record<string, string>).produktionsweg ?? '')
  return (
    <BerZeile l="Produktionsweg" e={pruef && f.produktionsweg ? f.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fe('produktionsweg')}
        value={v}
        onChange={e => {
          const x = e.target.value
          speichDetail({
            ...d,
            produktionsweg: x || null,
            ...KARTE_FALZ_MAT_NULL,
          } as CopyShopDetailJson)
        }}
      >
        <option value="">—</option>
        <option value="CC">CC</option>
        <option value="OFFSET">Offset</option>
        <option value="OFFEN">Offen</option>
      </select>
    </BerZeile>
  )
}

function BrosPwgWahl({ blk }: { blk: BlK }) {
  const { d, fe, f, pruef, speichDetail } = blk
  const v = String((d as Record<string, string>).produktionsweg ?? '')
  return (
    <BerZeile l="Produktionsweg" e={pruef && f.produktionsweg ? f.produktionsweg : undefined}>
      <select
        className={'ber-inp' + fe('produktionsweg')}
        value={v}
        onChange={e => {
          const x = e.target.value
          if (x === 'CC') {
            speichDetail({
              ...d,
              produktionsweg: 'CC',
              ...BROSCH_MAT_NULL,
              brosch_bindung: 'DRAHTHEFTUNG',
            } as CopyShopDetailJson)
          } else {
            speichDetail({
              ...d,
              produktionsweg: x || null,
              ...BROSCH_MAT_NULL,
            } as CopyShopDetailJson)
          }
        }}
      >
        <option value="">—</option>
        <option value="CC">CC</option>
        <option value="OFFSET">Offset</option>
        <option value="OFFEN">Offen</option>
      </select>
    </BerZeile>
  )
}

function BroschOffsetOffenForm(p: BlK) {
  return (
    <>
      <SelB
        {...p}
        k="brosch_bindung"
        l="Bindung"
        o={[
          { v: 'DRAHTHEFTUNG', t: 'Drahtheftung' },
          { v: 'RINGSÖSEN', t: 'Ringsösen' },
          { v: 'KLEBEBINDUNG', t: 'Klebebindung' },
          { v: 'SPIRALBINDUNG', t: 'Spiralbindung' },
        ]}
      />
      <SelB
        {...p}
        k="brosch_u_gramm"
        l="Umschlag Grammatur"
        o={['135G', '170G', '250G', '300G'].map(x => ({ v: x, t: x }))}
      />
      <SelB
        {...p}
        k="brosch_u_ober"
        l="Umschlag Oberfläche"
        o={[
          { v: 'MATT', t: 'Matt' },
          { v: 'GLAENZEND', t: 'Glänzend' },
        ]}
      />
      <SelB
        {...p}
        k="brosch_i_gramm"
        l="Inhalt Grammatur"
        o={['90G', '135G', '170G'].map(x => ({ v: x, t: x }))}
      />
      <SelB
        {...p}
        k="brosch_i_ober"
        l="Inhalt Oberfläche"
        o={[
          { v: 'MATT', t: 'Matt' },
          { v: 'GLAENZEND', t: 'Glänzend' },
        ]}
      />
    </>
  )
}

function NmbFalzSeite(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const val = d.seitenzahl
  const s = val == null || val === undefined ? '' : String(val)
  return (
    <BerZeile l="Seitenzahl" e={pruef && f.seitenzahl ? f.seitenzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('seitenzahl')}
        min={2}
        max={100}
        step={2}
        value={s}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchL({ seitenzahl: null } as CopyShopDetailJson)
            return
          }
          let n = parseInt(raw, 10)
          if (Number.isNaN(n)) return
          n = Math.max(2, Math.min(100, n))
          if (n % 2 !== 0) n = n - 1
          if (n < 2) n = 2
          patchL({ seitenzahl: n } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function NmbBroschSeite(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const val = d.seitenzahl
  const s = val == null || val === undefined ? '' : String(val)
  return (
    <BerZeile l="Seitenzahl" e={pruef && f.seitenzahl ? f.seitenzahl : undefined}>
      <input
        type="number"
        className={'ber-inp' + fe('seitenzahl')}
        min={4}
        max={152}
        step={4}
        value={s}
        onChange={e => {
          const raw = e.target.value
          if (raw === '') {
            patchL({ seitenzahl: null } as CopyShopDetailJson)
            return
          }
          let n = parseInt(raw, 10)
          if (Number.isNaN(n)) return
          n = Math.max(4, Math.min(152, n))
          n = n - (n % 4)
          if (n < 4) n = 4
          patchL({ seitenzahl: n } as CopyShopDetailJson)
        }}
        onBlur={commit}
      />
    </BerZeile>
  )
}

function KarteFlyer(p: BlK) {
  const { d } = p
  const r = d as Record<string, string>
  const pwg = String(r.produktionsweg ?? '')
  return (
    <>
      <SelB
        {...p}
        k="farbigkeit"
        l="Farbigkeit"
        o={[
          { v: '1_0', t: '1/0' },
          { v: '1_1', t: '1/1' },
          { v: '4_0', t: '4/0' },
          { v: '4_4', t: '4/4' },
        ]}
      />
      <KfbFormatFeld din={KARTE_DIN} order={KARTE_FORMAT_ORDER} blk={p} />
      {String(r.format) === 'FREI' && <MasseHoeheBreite {...p} />}
      {boolSel({ ...p, k: 'randabfallend', l: 'Randabfallend' })}
      <KfbPwgKarteFalz blk={p} />
      {pwg === 'CC' && (
        <MaterialCC
          d={d}
          fe={p.fe}
          f={p.f}
          pruef={p.pruef}
          patchL={p.patchL}
          commit={p.commit}
          speichDetail={p.speichDetail}
          kMat="material_cc"
          kSon="material_cc_sonstige"
          label="Material"
        />
      )}
      {pwg === 'OFFSET' && <MaterialOffset {...p} speichDetail={p.speichDetail} />}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function Falzflyer(p: BlK) {
  const { d } = p
  const r = d as Record<string, string>
  const pwg = String(r.produktionsweg ?? '')
  return (
    <>
      <SelB
        {...p}
        k="farbigkeit"
        l="Farbigkeit"
        o={[
          { v: '1_1', t: '1/1' },
          { v: '4_4', t: '4/4' },
        ]}
      />
      <SelB
        {...p}
        k="falzart"
        l="Falzart"
        o={[
          { v: 'MITTELFALZ', t: 'Mittelfalz' },
          { v: 'WICKELFALZ', t: 'Wickelfalz' },
          { v: 'ZICKZACK', t: 'Zick-Zack-Falz' },
        ]}
      />
      <KfbFormatFeld din={FALZ_DIN as Record<string, { b: number; h: number }>} order={FALZ_FORMAT_ORDER} blk={p} />
      {String(r.format) === 'FREI' && <MasseHoeheBreite {...p} />}
      <NmbFalzSeite {...p} />
      {boolSel({ ...p, k: 'randabfallend', l: 'Randabfallend' })}
      <KfbPwgKarteFalz blk={p} />
      {pwg === 'CC' && (
        <MaterialCC
          d={d}
          fe={p.fe}
          f={p.f}
          pruef={p.pruef}
          patchL={p.patchL}
          commit={p.commit}
          speichDetail={p.speichDetail}
          kMat="material_cc"
          kSon="material_cc_sonstige"
          label="Material"
        />
      )}
      {pwg === 'OFFSET' && <MaterialOffset {...p} speichDetail={p.speichDetail} />}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function Broschuere(p: BlK) {
  const { d, fe, f, pruef } = p
  const r = d as Record<string, string>
  const pwg = String(r.produktionsweg ?? '')
  const oStr = r.orientierung ?? ''
  return (
    <>
      <KfbFormatFeld din={BROS_DIN} order={BROSCH_FORMAT_ORDER} blk={p} />
      <BerZeile
        l="Ausrichtung"
        e={pruef && (f.orientierung || f.brosch_quer_cc) ? f.orientierung || f.brosch_quer_cc : undefined}
      >
        <select
          className={'ber-inp' + (pruef && f.brosch_quer_cc ? fe('brosch_quer_cc') : fe('orientierung'))}
          value={oStr}
          onChange={e =>
            p.speichDetail({ ...d, orientierung: e.target.value } as CopyShopDetailJson)
          }
        >
          <option value="">—</option>
          <option value="HOCHFORMAT">Hochformat</option>
          <option value="QUERFORMAT">Querformat</option>
        </select>
      </BerZeile>
      <NmbBroschSeite {...p} />
      <BrosPwgWahl blk={p} />
      {pwg === 'CC' && (
        <>
          <p className="ber-hinweis">Bindung: Drahtheftung (fix)</p>
          <MaterialCC
            d={d}
            fe={p.fe}
            f={p.f}
            pruef={p.pruef}
            patchL={p.patchL}
            commit={p.commit}
            speichDetail={p.speichDetail}
            kMat="cc_umschlag"
            kSon="cc_umschlag_sonstige"
            label="Umschlag"
          />
          <MaterialCC
            d={d}
            fe={p.fe}
            f={p.f}
            pruef={p.pruef}
            patchL={p.patchL}
            commit={p.commit}
            speichDetail={p.speichDetail}
            kMat="cc_inhalt"
            kSon="cc_inhalt_sonstige"
            label="Inhalt"
          />
        </>
      )}
      {(pwg === 'OFFSET' || pwg === 'OFFEN') && <BroschOffsetOffenForm {...p} />}
      {boolSel({ ...p, k: 'randabfallend', l: 'Randabfallend' })}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function Visitenkarte(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  const r = d as Record<string, string>
  const fmt = String(r.format ?? '')
  const mat = String(r.material ?? '')
  return (
    <>
      <SelB
        {...p}
        k="format"
        l="Format"
        o={[
          { v: 'STANDARD_85_55', t: '85 × 55 mm (Standard)' },
          { v: 'STANDARD_90_50', t: '90 × 50 mm' },
          { v: 'FREI', t: 'Frei' },
        ]}
      />
      <SelB
        {...p}
        k="orientierung"
        l="Ausrichtung"
        o={[
          { v: 'HOCHFORMAT', t: 'Hochformat' },
          { v: 'QUERFORMAT', t: 'Querformat' },
        ]}
      />
      <SelB
        {...p}
        k="farbigkeit"
        l="Farbigkeit"
        o={[
          { v: '4_0', t: '4/0' },
          { v: '4_4', t: '4/4' },
        ]}
      />
      <SelB
        {...p}
        k="druckseite"
        l="Druckseite"
        o={[
          { v: '1_SEITIG', t: '1-seitig' },
          { v: '2_SEITIG', t: '2-seitig' },
        ]}
      />
      <BerZeile l="Material" e={pruef && f.material ? f.material : undefined}>
        <select
          className={'ber-inp' + fe('material')}
          value={mat}
          onChange={e => {
            const v = e.target.value
            const patch: CopyShopDetailJson = { material: v }
            if (v !== '350G_OFFSET') (patch as Record<string, unknown>).folienkaschiert = null
            if (v !== 'MULTILOFT') (patch as Record<string, unknown>).multiloft_farbkern = null
            speichDetail({ ...d, ...patch } as CopyShopDetailJson)
          }}
        >
          <option value="">—</option>
          {VISITENKARTE_MATERIALIEN.map(x => (
            <option key={x.wert} value={x.wert}>
              {x.anzeige}
            </option>
          ))}
        </select>
      </BerZeile>
      {mat === '350G_OFFSET' && boolSel({ ...p, k: 'folienkaschiert', l: 'Beidseitig Folienkaschiert matt' })}
      {mat === 'MULTILOFT' && (
        <SelB
          {...p}
          k="multiloft_farbkern"
          l="Farbkern"
          o={MULTILOFT_FARBKERNE.map(x => ({ v: x.wert, t: x.anzeige }))}
        />
      )}
      {fmt === 'FREI' && <MasseHoeheBreite {...p} />}
      {boolSel({ ...p, k: 'randabfallend', l: 'Randabfallend' })}
      <BesonderheitenUnten {...p} />
    </>
  )
}

function BindungFreiMasse(p: BlK) {
  const { d, fe, f, pruef, patchL, commit } = p
  const b = d.format_breite
  const h = d.format_hoehe
  const sb = b === null || b === undefined ? '' : String(b)
  const sh = h === null || h === undefined ? '' : String(h)
  return (
    <div>
      <div className="ber-zeile">
        <span className="ber-lbl">Format Breite (mm)</span>
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('format_breite')}
            min={0.01}
            step={0.01}
            value={sb}
            onChange={e => {
              const raw = e.target.value
              patchL({
                format_breite: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
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
            className={'ber-inp' + fe('format_hoehe')}
            min={0.01}
            max={300}
            step={0.01}
            value={sh}
            onChange={e => {
              const raw = e.target.value
              patchL({
                format_hoehe: raw === '' ? null : parseFloat(raw),
              } as CopyShopDetailJson)
            }}
            onBlur={commit}
          />
          {pruef && f.format_hoehe && <p className="ber-err ber-err--mass">{f.format_hoehe}</p>}
        </div>
      </div>
    </div>
  )
}

function BindungF(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  const r = d as Record<string, string>
  const ba = String(r.bindungsart ?? '') as
    | 'WIRE_O'
    | 'KUNSTSTOFFSPIRALE'
    | 'SOFTCOVER'
    | 'HARDCOVER'
    | ''
  const wireFmt = String(r.format ?? '')
  return (
    <>
      <BerZeile l="Material" e={pruef && f.material ? f.material : undefined}>
        <select
          className={'ber-inp' + fe('material')}
          value={r.material ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v === 'SONSTIGE') {
              speichDetail({ ...d, material: v } as CopyShopDetailJson)
            } else {
              speichDetail({ ...d, material: v, material_sonstige: null } as CopyShopDetailJson)
            }
          }}
        >
          <option value="">—</option>
          {BINDUNG_MATERIALIEN.map(x => (
            <option key={String(x.wert)} value={String(x.wert)}>
              {x.anzeige}
            </option>
          ))}
        </select>
      </BerZeile>
      {r.material === 'SONSTIGE' && <Txt {...p} k="material_sonstige" l="Material (sonstige)" rows={2} />}
      <SelB
        {...p}
        k="farbigkeit"
        l="Farbigkeit"
        o={[
          { v: '1_0', t: '1/0' },
          { v: '1_1', t: '1/1' },
          { v: '4_0', t: '4/0' },
          { v: '4_1', t: '4/1' },
        ]}
      />
      <BerZeile l="Bindungsart" e={pruef && f.bindungsart ? f.bindungsart : undefined}>
        <select
          className={'ber-inp' + fe('bindungsart')}
          value={ba}
          onChange={e => {
            const v = e.target.value
            if (v === 'SOFTCOVER' || v === 'HARDCOVER') {
              speichDetail({
                ...d,
                bindungsart: v,
                format: 'A4',
                orientierung: 'HOCHFORMAT',
                format_breite: 210,
                format_hoehe: 297,
                hardcover_druck: v === 'HARDCOVER' ? d.hardcover_druck : null,
                hardcover_einband: v === 'HARDCOVER' ? d.hardcover_einband : null,
              } as CopyShopDetailJson)
            } else if (v === 'WIRE_O' || v === 'KUNSTSTOFFSPIRALE') {
              speichDetail({
                ...d,
                bindungsart: v,
                format: 'A5',
                orientierung: 'HOCHFORMAT',
                hardcover_druck: null,
                hardcover_einband: null,
                format_breite: null,
                format_hoehe: null,
              } as CopyShopDetailJson)
            } else {
              speichDetail({ ...d, bindungsart: v || null } as CopyShopDetailJson)
            }
          }}
        >
          <option value="">—</option>
          <option value="WIRE_O">Wire-O</option>
          <option value="KUNSTSTOFFSPIRALE">Kunststoffspirale</option>
          <option value="SOFTCOVER">Softcover</option>
          <option value="HARDCOVER">Hardcover</option>
        </select>
      </BerZeile>

      <FarbeBindung {...p} bindungsart={ba} />

      {ba === 'WIRE_O' || ba === 'KUNSTSTOFFSPIRALE' ? (
        <BerZeile l="Format" e={pruef && f.format ? f.format : undefined}>
          <select
            className={'ber-inp' + fe('format')}
            value={wireFmt}
            onChange={e => {
              const v = e.target.value
              if (v === 'A3') {
                speichDetail({ ...d, format: v, orientierung: 'QUERFORMAT' } as CopyShopDetailJson)
              } else if (v === 'FREI') {
                speichDetail({
                  ...d,
                  format: 'FREI',
                  orientierung: null,
                  format_breite: null,
                  format_hoehe: null,
                } as CopyShopDetailJson)
              } else if (v === 'A5' || v === 'A4') {
                const o0 = (r.orientierung as string) || 'HOCHFORMAT'
                const o1 = o0 === 'QUERFORMAT' || o0 === 'HOCHFORMAT' ? o0 : 'HOCHFORMAT'
                speichDetail({ ...d, format: v, orientierung: o1 } as CopyShopDetailJson)
              } else {
                speichDetail({ ...d, format: v } as CopyShopDetailJson)
              }
            }}
          >
            <option value="">—</option>
            <option value="A5">A5</option>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="FREI">Frei</option>
          </select>
        </BerZeile>
      ) : null}

      {ba === 'WIRE_O' || ba === 'KUNSTSTOFFSPIRALE' ? (wireFmt === 'A5' || wireFmt === 'A4' ? (
        <SelB
          {...p}
          k="orientierung"
          l="Ausrichtung"
          o={[
            { v: 'HOCHFORMAT', t: 'Hochformat' },
            { v: 'QUERFORMAT', t: 'Querformat' },
          ]}
        />
      ) : wireFmt === 'A3' ? (
        <BerZeile l="Ausrichtung" c={<span className="td-wert">Querformat (fix)</span>} />
      ) : null) : null}

      {ba === 'WIRE_O' || ba === 'KUNSTSTOFFSPIRALE' ? (wireFmt === 'FREI' ? <BindungFreiMasse {...p} /> : null) : null}

      {ba === 'SOFTCOVER' || ba === 'HARDCOVER' ? (
        <BerZeile l="Format" c={<span className="td-wert">A4 Hochformat (210 × 297 mm)</span>} />
      ) : null}

      {boolSel({ ...p, k: 'randabfallend', l: 'Randabfallend' })}

      {ba === 'HARDCOVER' && (
        <>
          {boolSel({ ...p, k: 'hardcover_druck', l: 'Druck auf Hardcover' })}
          {d.hardcover_druck === true && <Txt {...p} k="hardcover_einband" l="Hardcover Einband" rows={2} />}
        </>
      )}

      <BesonderheitenUnten {...p} />
    </>
  )
}

function FarbeBindung(
  p: BlK & {
    bindungsart: 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | ''
  },
) {
  const { bindungsart: ba, d, fe, f, pruef, speichDetail } = p
  let o: { v: string; t: string }[] = []
  if (ba === 'WIRE_O') {
    o = [
      { v: 'SCHWARZ', t: 'Schwarz' },
      { v: 'SILBER', t: 'Silber' },
    ]
  } else if (ba === 'KUNSTSTOFFSPIRALE') {
    o = [
      { v: 'SCHWARZ', t: 'Schwarz' },
      { v: 'WEISS', t: 'Weiß' },
    ]
  } else if (ba === 'SOFTCOVER' || ba === 'HARDCOVER') {
    o = [
      { v: 'SCHWARZ', t: 'Schwarz' },
      { v: 'DUNKELBLAU', t: 'Dunkelblau' },
      { v: 'DUNKELROT', t: 'Dunkelrot' },
    ]
  }
  return (
    <BerZeile l="Bindungsfarbe" e={pruef && f.bindungsart_farbe ? f.bindungsart_farbe : undefined}>
      <select
        className={'ber-inp' + fe('bindungsart_farbe')}
        value={String((d as Record<string, string>).bindungsart_farbe ?? '')}
        onChange={e =>
          speichDetail({ ...d, bindungsart_farbe: e.target.value } as CopyShopDetailJson)
        }
        disabled={!ba}
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

function AusdruckF(p: BlK) {
  const { d, fe, f, pruef, speichDetail } = p
  const mat = String((d as Record<string, string>).material ?? '')
  return (
    <>
      <SelB
        {...p}
        k="format"
        l="Format"
        o={[
          { v: 'A5', t: 'A5' },
          { v: 'A4', t: 'A4' },
          { v: 'A3', t: 'A3' },
        ]}
      />
      <BerZeile l="Material" e={pruef && f.material ? f.material : undefined}>
        <select
          className={'ber-inp' + fe('material')}
          value={mat}
          onChange={e => {
            const v = e.target.value
            if (v === 'SONSTIGE') {
              speichDetail({ ...d, material: v } as CopyShopDetailJson)
            } else {
              speichDetail({ ...d, material: v, material_sonstige: null } as CopyShopDetailJson)
            }
          }}
        >
          <option value="">—</option>
          {AUSDRUCK_MATERIALIEN.map(x => (
            <option key={String(x.wert)} value={String(x.wert)}>
              {x.anzeige}
            </option>
          ))}
        </select>
      </BerZeile>
      {mat === 'SONSTIGE' && <Txt {...p} k="material_sonstige" l="Material (sonstige)" rows={2} />}
      <SelB
        {...p}
        k="farbigkeit"
        l="Farbigkeit"
        o={[
          { v: '1_0', t: '1/0' },
          { v: '1_1', t: '1/1' },
          { v: '4_0', t: '4/0' },
          { v: '4_1', t: '4/1' },
        ]}
      />
      <SelB
        {...p}
        k="lochen"
        l="Lochen"
        o={[
          { v: 'NEIN', t: 'Nein' },
          { v: '2_LOCH', t: '2 Loch' },
          { v: '4_LOCH', t: '4 Loch' },
        ]}
      />
      {boolSel({ ...p, k: 'heften', l: 'Heften' })}
      <SelB
        {...p}
        k="laminieren"
        l="Laminieren"
        o={[
          { v: 'NEIN', t: 'Nein' },
          { v: 'MATT', t: 'Matt' },
          { v: 'GLAENZEND', t: 'Glänzend' },
        ]}
      />
      <BesonderheitenUnten {...p} />
    </>
  )
}
