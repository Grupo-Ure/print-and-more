import { useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { kundenName } from '../lib/kunde'
import { teilJsonAlsFeldertabelle, type Auftrag, type TeilauftragRow } from '../types/database'
import { TEILAUFTRAG_BEREICH_ANZEIGE, teilauftragBereichLabel } from '../types/database'
import { LFP_TEILTYP_ANZEIGE } from '../types/lfp'
import { COPY_SHOP_TYPS_ANZEIGE } from '../types/copyshop'
import { STEMPEL_TYP_ANZEIGE } from '../types/stempel'
import { LASER_TYP_ANZEIGE } from '../types/laser'
import { DateInput } from './DateInput'
import { useToast } from './Toast'
import type { Database } from '../types/supabase'

type TextilMotiveRow = Database['public']['Tables']['textil_motive']['Row']
type TextilPositionenRow = Database['public']['Tables']['textil_positionen']['Row']
type TextilZuordnungRow = Database['public']['Tables']['textil_zuordnungen']['Row']

type Props = {
  auftrag: Auftrag
  teilauftraege: TeilauftragRow[]
  onErfolg: (neuerAuftrag: Auftrag) => void
  onAbbrechen: () => void
}

type Schritt = 1 | 2

function typLesbar(bereich: string, typ: string | null): string {
  if (!typ) return '—'
  if (bereich === 'LFP' && typ in LFP_TEILTYP_ANZEIGE) return LFP_TEILTYP_ANZEIGE[typ as keyof typeof LFP_TEILTYP_ANZEIGE]
  if (bereich === 'COPYSHOP' && typ in COPY_SHOP_TYPS_ANZEIGE)
    return COPY_SHOP_TYPS_ANZEIGE[typ as keyof typeof COPY_SHOP_TYPS_ANZEIGE]
  if (bereich === 'STEMPEL' && typ in STEMPEL_TYP_ANZEIGE)
    return STEMPEL_TYP_ANZEIGE[typ as keyof typeof STEMPEL_TYP_ANZEIGE]
  if (bereich === 'LASERGRAVUR' && typ in LASER_TYP_ANZEIGE)
    return LASER_TYP_ANZEIGE[typ as keyof typeof LASER_TYP_ANZEIGE]
  return typ
}

function formatAusDetail(detail: import('../types/database').TeilauftragRow['detail']): string {
  const o = teilJsonAlsFeldertabelle(detail)
  const b = o.format_breite
  const h = o.format_hoehe
  const bn = typeof b === 'number' ? b : typeof b === 'string' && b.trim() !== '' ? Number(b) : null
  const hn = typeof h === 'number' ? h : typeof h === 'string' && h.trim() !== '' ? Number(h) : null
  const bOk = bn != null && Number.isFinite(bn) && bn > 0
  const hOk = hn != null && Number.isFinite(hn) && hn > 0
  const bTxt = bOk ? String(Math.round(bn as number)) : ''
  const hTxt = hOk ? String(Math.round(hn as number)) : ''
  if (bOk && hOk) return `${bTxt} × ${hTxt} mm`
  if (bOk) return `${bTxt} mm Breite`
  if (hOk) return `${hTxt} mm Höhe`
  return ''
}

export function DuplizierenDialog({ auftrag, teilauftraege, onErfolg, onAbbrechen }: Props) {
  const aktive = useMemo(() => teilauftraege.filter(t => !t.storniert), [teilauftraege])
  const hatMehrAlsEinen = aktive.length > 1

  const [schritt, setSchritt] = useState<Schritt>(hatMehrAlsEinen ? 1 : 2)
  const [modus, setModus] = useState<'ALLE' | 'AUSWAEHLEN'>(hatMehrAlsEinen ? 'ALLE' : 'ALLE')
  const [auswahl, setAuswahl] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    for (const t of aktive) o[t.id] = true
    return o
  })
  const [terminNeu, setTerminNeu] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const { fehler: toastFehler, erfolg } = useToast()

  const gewaehlte = useMemo(() => aktive.filter(t => auswahl[t.id]), [aktive, auswahl])
  const minEins = gewaehlte.length >= 1

  const kundeLabel = (() => {
    const k = (auftrag as any).kunden ?? null
    if (!k) return auftrag.id
    return kundenName(k)
  })()

  const alleUebernehmen = () => {
    const o: Record<string, boolean> = {}
    for (const t of aktive) o[t.id] = true
    setAuswahl(o)
    setModus('ALLE')
    setSchritt(2)
  }

  const startAuswaehlen = () => {
    setModus('AUSWAEHLEN')
  }

  const weiter = () => {
    if (!minEins) return
    setSchritt(2)
  }

  const toggle = (id: string) => {
    setAuswahl(a => ({ ...a, [id]: !a[id] }))
  }

  const duplizieren = async () => {
    if (busy) return
    if (!minEins) return
    setBusy(true)
    setFehler(null)
    try {
      const { data: altRow, error: e0 } = await supabase
        .from('auftraege')
        .select('kunde_id')
        .eq('id', auftrag.id)
        .single()
      if (e0) throw e0
      const kunde_id = (altRow as { kunde_id: string | null }).kunde_id
      if (!kunde_id) throw new Error('kunde_id fehlt beim Ausgangsauftrag')

      const { data: neuA, error: e1 } = await supabase
        .from('auftraege')
        .insert({
          kunde_id,
          status: 'ANGEBOT',
          prioritaet: auftrag.prioritaet,
          lieferung: auftrag.lieferung,
          termin: terminNeu ? terminNeu : null,
        } as never)
        .select(AUFTRAG_SPALTEN)
        .single()
      if (e1) throw e1
      const neuerAuftrag = neuA as Auftrag

      for (const ta of gewaehlte) {
        const { data: neuTa, error: e2 } = await supabase
          .from('teilauftraege')
          .insert({
            auftrag_id: neuerAuftrag.id,
            bereich: ta.bereich,
            typ: ta.typ,
            status: 'UNVOLLSTAENDIG',
            prioritaet: ta.prioritaet,
            lieferung: ta.lieferung,
            detail: ta.detail,
          } as never)
          .select('id')
          .single()
        if (e2) throw e2
        const neuTaId = (neuTa as { id: string }).id

        if (ta.bereich === 'TEXTIL') {
          // Textil: Motive + Positionen + Zuordnungen mit ID-Mapping kopieren

          const { data: altMotive, error: eMotiv } = await supabase
            .from('textil_motive')
            .select('*')
            .eq('teilauftrag_id', ta.id)
          if (eMotiv) throw eMotiv

          const motivIdMap = new Map<string, string>()

          for (const m of altMotive ?? []) {
            const row = m as TextilMotiveRow
            const { id: _altMotivId, teilauftrag_id: _old, ...motivRest } = row
            const { data: neuMotiv, error: emErr } = await supabase
              .from('textil_motive')
              .insert({ ...motivRest, teilauftrag_id: neuTaId })
              .select('id')
              .single()
            if (emErr) throw emErr
            motivIdMap.set(_altMotivId, (neuMotiv as { id: string }).id)
          }

          const { data: altPositionen, error: ePos } = await supabase
            .from('textil_positionen')
            .select('*')
            .eq('teilauftrag_id', ta.id)
          if (ePos) throw ePos

          const posIdMap = new Map<string, string>()

          for (const p of altPositionen ?? []) {
            const row = p as TextilPositionenRow
            const { id: _altPosId, teilauftrag_id: _old, ...posRest } = row
            const { data: neuPos, error: epErr } = await supabase
              .from('textil_positionen')
              .insert({ ...posRest, teilauftrag_id: neuTaId })
              .select('id')
              .single()
            if (epErr) throw epErr
            posIdMap.set(_altPosId, (neuPos as { id: string }).id)
          }

          const { data: altZuordnungen, error: eZuo } = await supabase
            .from('textil_zuordnungen')
            .select('*')
            .eq('teilauftrag_id', ta.id)
          if (eZuo) throw eZuo

          for (const z of altZuordnungen ?? []) {
            const row = z as TextilZuordnungRow
            const { id: _altZId, teilauftrag_id: _old, motiv_id: altMotivId, position_id: altPosId, ...zRest } =
              row
            const neuMotivId = altMotivId ? motivIdMap.get(altMotivId) : undefined
            const neuPosId = altPosId ? posIdMap.get(altPosId) : undefined
            if (altMotivId && neuMotivId == null) throw new Error('Duplizieren: Motiv-Zuordnung fehlgeschlagen')
            if (altPosId && neuPosId == null) throw new Error('Duplizieren: Positions-Zuordnung fehlgeschlagen')
            const { error: ezErr } = await supabase.from('textil_zuordnungen').insert({
              ...zRest,
              teilauftrag_id: neuTaId,
              motiv_id: neuMotivId ?? altMotivId,
              position_id: neuPosId ?? altPosId,
            })
            if (ezErr) throw ezErr
          }
        } else {
          // Alle anderen Bereiche: teilauftrag_produkte kopieren
          const { data: altProdukte, error: eProd } = await supabase
            .from('teilauftrag_produkte')
            .select('*')
            .eq('teilauftrag_id', ta.id)
            .order('sort_order')
          if (eProd) throw eProd

          for (const p of (altProdukte ?? []) as Record<string, unknown>[]) {
            const { id: _altPId, teilauftrag_id: _old, ...pRest } = p as {
              id: string
              teilauftrag_id: string
              [k: string]: unknown
            }
            const { error: epErr } = await supabase.from('teilauftrag_produkte').insert({
              ...pRest,
              teilauftrag_id: neuTaId,
            } as never)
            if (epErr) throw epErr
          }
        }
      }

      // Historie beim neuen Auftrag (nicht im Typ enthalten → direkt insert).
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        await supabase.from('historie').insert({
          auftrag_id: neuerAuftrag.id,
          person_id: user?.id ?? null,
          ereignisart: 'AUFTRAG_ERSTELLT',
          meta: {
            dupliziert_von: auftrag.id,
            dupliziert_von_nummer: auftrag.auftragsnummer,
          },
        } as never)
      } catch {
        console.error('Historie-Insert fehlgeschlagen')
      }

      erfolg('Auftrag dupliziert')
      onErfolg(neuerAuftrag)
    } catch (e) {
      toastFehler('Auftrag konnte nicht dupliziert werden')
      setFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cp-modal-bg" role="dialog" aria-modal="true" aria-label="Auftrag duplizieren">
      <div className="cp-modal">
        {schritt === 1 && (
          <>
            <h3>Welche Teilaufträge übernehmen?</h3>
            <p className="cp-hinweis">Nur aktive (nicht stornierte) Teilaufträge.</p>

            <div className="cp-modal-bar" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <button type="button" className="cp-btn" onClick={alleUebernehmen}>
                Alle übernehmen
              </button>
              <button type="button" className="cp-btn" onClick={startAuswaehlen}>
                Auswählen
              </button>
            </div>

            {modus === 'AUSWAEHLEN' && (
              <div className="cp-stack" style={{ marginTop: 12 }}>
                {aktive.map(t => (
                  <label key={t.id} className="cp-toggle" style={{ alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={!!auswahl[t.id]} onChange={() => toggle(t.id)} />
                    <span>
                      {(t.bereich in TEILAUFTRAG_BEREICH_ANZEIGE ? TEILAUFTRAG_BEREICH_ANZEIGE[t.bereich as keyof typeof TEILAUFTRAG_BEREICH_ANZEIGE] : teilauftragBereichLabel(t.bereich))}{' '}
                      · {typLesbar(t.bereich, t.typ)}{' '}
                      {formatAusDetail(t.detail) ? `· ${formatAusDetail(t.detail)}` : ''}
                    </span>
                  </label>
                ))}
                {!minEins && <p className="cp-hinweis">Mindestens 1 Teilauftrag wählen.</p>}
                <div className="cp-modal-bar">
                  <button type="button" className="cp-btn" onClick={onAbbrechen}>
                    Abbrechen
                  </button>
                  <button type="button" className="cp-btn" disabled={!minEins} onClick={weiter}>
                    Weiter
                  </button>
                </div>
              </div>
            )}

            {modus === 'ALLE' && (
              <div className="cp-modal-bar">
                <button type="button" className="cp-btn" onClick={onAbbrechen}>
                  Abbrechen
                </button>
              </div>
            )}
          </>
        )}

        {schritt === 2 && (
          <>
            <h3>Auftrag duplizieren</h3>
            <p className="cp-hinweis" style={{ marginTop: 6 }}>
              Kunde: <strong>{kundeLabel}</strong>
              <br />
              Teilaufträge: <strong>{gewaehlte.length}</strong>
            </p>

            <div style={{ marginTop: 10 }}>
              <p className="cp-hinweis">Neuer Termin (optional)</p>
              <DateInput
                className="cp-select"
                value={terminNeu}
                onChange={e => setTerminNeu(e.target.value)}
                placeholder="Kein Termin — später setzen"
              />
              {!terminNeu && (
                <p className="cp-hinweis" style={{ marginTop: 6 }}>
                  Kein Termin — später setzen
                </p>
              )}
            </div>

            {fehler && <p className="cp-hinweis" style={{ color: '#b91c1c' }}>{fehler}</p>}

            <div className="cp-modal-bar" style={{ marginTop: 12 }}>
              <button type="button" className="cp-btn" disabled={busy} onClick={onAbbrechen}>
                Abbrechen
              </button>
              <button type="button" className="cp-btn" disabled={busy || !minEins} onClick={() => void duplizieren()}>
                Duplizieren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

