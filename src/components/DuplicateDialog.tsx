import { useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { AUFTRAG_SPALTEN } from '../const/auftragSelect'
import { customerName } from '../lib/customer'
import { teilJsonAlsFeldertabelle, type Auftrag, type TeilauftragRow } from '../types/database'
import { TEILAUFTRAG_BEREICH_ANZEIGE, teilauftragBereichLabel } from '../types/database'
import { LFP_TYPE_LABELS } from '../types/lfp'
import { COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { STAMP_TYPE_LABELS } from '../types/stamp'
import { LASER_TYPE_LABELS } from '../types/laser'
import { DateInput } from './DateInput'
import { useToast } from './Toast'

type Props = {
  auftrag: Auftrag
  teilauftraege: TeilauftragRow[]
  onSuccess: (neuerAuftrag: Auftrag) => void
  onCancel: () => void
}

type Schritt = 1 | 2

function typLesbar(bereich: string, typ: string | null): string {
  if (!typ) return '—'
  if (bereich === 'LFP' && typ in LFP_TYPE_LABELS) return LFP_TYPE_LABELS[typ as keyof typeof LFP_TYPE_LABELS]
  if (bereich === 'COPYSHOP' && typ in COPY_SHOP_TYPE_LABELS)
    return COPY_SHOP_TYPE_LABELS[typ as keyof typeof COPY_SHOP_TYPE_LABELS]
  if (bereich === 'STEMPEL' && typ in STAMP_TYPE_LABELS)
    return STAMP_TYPE_LABELS[typ as keyof typeof STAMP_TYPE_LABELS]
  if (bereich === 'LASERGRAVUR' && typ in LASER_TYPE_LABELS)
    return LASER_TYPE_LABELS[typ as keyof typeof LASER_TYPE_LABELS]
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

export function DuplicateDialog({ auftrag, teilauftraege, onSuccess, onCancel }: Props) {
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
    const k = auftrag.kunden ?? null
    if (!k) return auftrag.id
    return customerName(k)
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
      const { data: neuerAuftragId, error } = await supabase.rpc('dupliziere_auftrag', {
        p_auftrag_id: auftrag.id,
        p_prioritaet: auftrag.prioritaet ?? null,
        p_lieferung: auftrag.lieferung ?? null,
        p_termin: terminNeu ? terminNeu : null,
        p_teilauftrag_ids: gewaehlte.map(ta => ta.id),
        p_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      if (error) throw error

      if (typeof neuerAuftragId !== 'string' || neuerAuftragId.trim() === '') {
        toastFehler('Auftrag konnte nicht dupliziert werden')
        return
      }

      const { data: neuA, error: eLoad } = await supabase
        .from('auftraege')
        .select(AUFTRAG_SPALTEN)
        .eq('id', neuerAuftragId)
        .single()
      if (eLoad) throw eLoad
      const neuerAuftrag = neuA as Auftrag

      erfolg('Auftrag dupliziert')
      onSuccess(neuerAuftrag)
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
                  <button type="button" className="cp-btn" onClick={onCancel}>
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
                <button type="button" className="cp-btn" onClick={onCancel}>
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
              <button type="button" className="cp-btn" disabled={busy} onClick={onCancel}>
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

