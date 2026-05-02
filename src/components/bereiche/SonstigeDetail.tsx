import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../supabase'
import { validateSonstigeDetail } from '../../lib/sonstige/validateSonstigeDetail'
import type { AuftragStatus, TeilauftragRow } from '../../types/database'
import type { Database, Json } from '../../types/supabase'
import { useToast } from '../Toast'
import '../WorkArea.css'

export type SonstigeDetailJson = Record<string, unknown>

type Props = {
  teil: TeilauftragRow
  teilStatus: AuftragStatus
  onDetailPatch: (patch: { typ?: string | null; detail: SonstigeDetailJson | null }) => Promise<void>
}

type ProduktRow = {
  id: string
  teilauftrag_id: string
  bereich: string
  detail: SonstigeDetailJson
  sort_order: number | null
  erstellt_am: string | null
}

const SONSTIGE_TYP = 'SONSTIGE' as const

function sonstigeRoh(teil: TeilauftragRow): SonstigeDetailJson {
  const d = teil.detail
  return d && typeof d === 'object' && !Array.isArray(d) ? { ...d } : {}
}

type BlK = {
  d: SonstigeDetailJson
  fe: (k: string) => string
  pruef: boolean
  f: Record<string, string>
  patchL: (p: SonstigeDetailJson) => void
  commit: () => void
  speichDetail: (d: SonstigeDetailJson) => void
}

export function SonstigeDetail({ teil, teilStatus, onDetailPatch }: Props) {
  const { fehler: toastFehler } = useToast()

  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [produkteLaden, setProdukteLaden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [detail, setDetail] = useState<SonstigeDetailJson>(sonstigeRoh(teil))
  const detailR = useRef(detail)
  useEffect(() => {
    detailR.current = detail
  }, [detail])

  useEffect(() => {
    setEditingId(null)
  }, [teil.id])

  useEffect(() => {
    if (editingId !== null) return
    const d = sonstigeRoh(teil)
    setDetail(d)
    detailR.current = d
  }, [teil.id, teil.detail, editingId])

  const reloadProdukte = useCallback(async (): Promise<ProduktRow[]> => {
    if (!teil.id) return []
    setProdukteLaden(true)
    const { data, error } = await supabase
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', teil.id)
      .eq('bereich', 'SONSTIGE')
      .order('sort_order')
    setProdukteLaden(false)
    if (error) {
      toastFehler('Produkte konnten nicht geladen werden')
      setProdukte([])
      return []
    }
    const rows = (data ?? []) as Database['public']['Tables']['teilauftrag_produkte']['Row'][]
    const mapped: ProduktRow[] = rows.map(r => ({
      id: r.id,
      teilauftrag_id: r.teilauftrag_id,
      bereich: r.bereich,
      detail: (r.detail ?? {}) as unknown as SonstigeDetailJson,
      sort_order: r.sort_order,
      erstellt_am: r.erstellt_am,
    }))
    setProdukte(mapped)
    return mapped
  }, [teil.id, toastFehler])

  useEffect(() => {
    void reloadProdukte()
  }, [reloadProdukte])

  const resetForm = useCallback(() => {
    setEditingId(null)
    const d = sonstigeRoh(teil)
    setDetail(d)
    detailR.current = d
  }, [teil])

  const sonstigeFehler = validateSonstigeDetail(detail, teilStatus)
  const pruef = teilStatus !== 'ANGEBOT'
  const fe = (k: string) => (pruef && sonstigeFehler[k] ? ' ber-inp--err' : '')

  const speich = useCallback(
    async (d: SonstigeDetailJson) => {
      setDetail(d)
      detailR.current = d
      if (editingId !== null) return
      await onDetailPatch({ typ: teil.typ?.trim() ? teil.typ : SONSTIGE_TYP, detail: d })
    },
    [onDetailPatch, teil.typ, editingId]
  )

  const patchL = useCallback((p: SonstigeDetailJson) => {
    setDetail(d0 => {
      const n = { ...d0, ...p }
      detailR.current = n
      return n
    })
  }, [])

  const commit = useCallback(() => {
    void speich({ ...detailR.current })
  }, [speich])

  const speichDetail = useCallback(
    (d: SonstigeDetailJson) => {
      setDetail(d)
      detailR.current = d
      void speich(d)
    },
    [speich]
  )

  const p: BlK = { d: detail, fe, pruef, f: sonstigeFehler, patchL, commit, speichDetail }

  const formOk = useMemo(() => Object.keys(sonstigeFehler).length === 0, [sonstigeFehler])

  const patchTyp = teil.typ?.trim() ? teil.typ : SONSTIGE_TYP

  const handleAddOrSave = useCallback(async () => {
    const d = { ...detailR.current }
    const errors = validateSonstigeDetail(d, teilStatus)
    if (Object.keys(errors).length > 0) return

    const detailMitTyp = { ...d, typ: SONSTIGE_TYP }

    if (editingId) {
      const patch: Database['public']['Tables']['teilauftrag_produkte']['Update'] = {
        detail: detailMitTyp as unknown as Json,
      }
      const { error } = await supabase.from('teilauftrag_produkte').update(patch).eq('id', editingId)
      if (error) {
        toastFehler('Produkt konnte nicht gespeichert werden')
        return
      }
      const list = await reloadProdukte()
      await onDetailPatch({
        typ: patchTyp,
        detail: {
          ...sonstigeRoh(teil),
          hat_produkte: list.length > 0,
        },
      })
      resetForm()
      return
    }

    const ins: Database['public']['Tables']['teilauftrag_produkte']['Insert'] = {
      teilauftrag_id: teil.id,
      bereich: 'SONSTIGE',
      detail: detailMitTyp as unknown as Json,
      sort_order: produkte.length,
    }
    const { error } = await supabase.from('teilauftrag_produkte').insert(ins)
    if (error) {
      toastFehler('Produkt konnte nicht hinzugefügt werden')
      return
    }
    const list = await reloadProdukte()
    await onDetailPatch({
      typ: patchTyp,
      detail: {
        ...sonstigeRoh(teil),
        hat_produkte: list.length > 0,
      },
    })
    resetForm()
  }, [
    teil.id,
    teil.detail,
    teilStatus,
    editingId,
    produkte.length,
    toastFehler,
    reloadProdukte,
    resetForm,
    onDetailPatch,
    patchTyp,
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
        typ: patchTyp,
        detail: {
          ...sonstigeRoh(teil),
          hat_produkte: list.length > 0,
        },
      })
      if (editingId === id) resetForm()
    },
    [toastFehler, reloadProdukte, editingId, resetForm, onDetailPatch, teil.detail, patchTyp]
  )

  const handleEdit = useCallback((row: ProduktRow) => {
    setEditingId(row.id)
    const raw = row.detail ?? {}
    const dd = { ...(raw as SonstigeDetailJson) }
    setDetail(dd)
    detailR.current = dd
  }, [])

  return (
    <div className="ber-lfp">
      <h3 className="ber-h3">Sonstige — Details</h3>
      <p className="ber-hinweis">Bei &apos;Sonstige&apos; wird PREPRESS_BEREIT nur manuell gesetzt.</p>

      <div className="ber-zeile" style={{ marginBottom: 8 }}>
        <span className="ber-lbl">Typ</span>
        <p className="td-wert td-mono" style={{ margin: 0 }}>
          {SONSTIGE_TYP}
        </p>
      </div>

      <BerZeile
        l="Beschreibung / Inhalt"
        e={pruef && sonstigeFehler.beschreibung ? sonstigeFehler.beschreibung : undefined}
        c={
          <div>
            <textarea
              className={'ber-inp' + fe('beschreibung')}
              rows={8}
              value={String(detail['beschreibung'] ?? '')}
              onChange={e => patchL({ beschreibung: e.target.value || null } as SonstigeDetailJson)}
              onBlur={commit}
            />
            <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
              Änderungen nach Produktionsfreigabe setzen den Status zurück
            </p>
          </div>
        }
      />

      <NmbStueckzahlOptional {...p} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="cp-btn"
          disabled={!formOk}
          onClick={() => void handleAddOrSave()}
        >
          {editingId ? 'Speichern' : 'Produkt hinzufügen'}
        </button>
        {editingId && (
          <button type="button" className="cp-btn cp-btn-grau" onClick={() => resetForm()}>
            Abbrechen
          </button>
        )}
      </div>

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
                  const st = pd.stueckzahl ?? ''
                  const beschr =
                    String(pd.beschreibung ?? '')
                      .trim()
                      .slice(0, 72) || '—'
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{SONSTIGE_TYP}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{String(st || '—')}</td>
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

function NmbStueckzahlOptional(a: BlK) {
  const { d, fe, f, pruef, patchL, commit } = a
  const raw = d.stueckzahl
  let numForInput: number | '' = ''
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) numForInput = raw
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isInteger(n) && n >= 1) numForInput = n
  }
  return (
    <BerZeile
      l="Stückzahl (optional)"
      e={pruef && f.stueckzahl ? f.stueckzahl : undefined}
      c={
        <div>
          <input
            type="number"
            className={'ber-inp' + fe('stueckzahl')}
            value={numForInput}
            onChange={e => {
              const v = e.target.value
              patchL({ stueckzahl: v === '' ? null : parseInt(v, 10) } as SonstigeDetailJson)
            }}
            onBlur={commit}
            min={1}
            placeholder="—"
          />
          <p className="ber-hinweis" style={{ marginTop: 6, marginBottom: 0 }}>
            Falls relevant, Stückzahl hier oder in der Beschreibung angeben
          </p>
        </div>
      }
    />
  )
}
