import { useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { customerName } from '../lib/customer'
import { subOrderDetailToFieldMap, type Auftrag, type SubOrderRow } from '../types/database'
import { SUB_ORDER_DEPARTMENT_LABELS, subOrderDepartmentLabel } from '../types/database'
import { LFP_TYPE_LABELS } from '../types/lfp'
import { COPY_SHOP_TYPE_LABELS } from '../types/copyshop'
import { STAMP_TYPE_LABELS } from '../types/stamp'
import { LASER_TYPE_LABELS } from '../types/laser'
import { DateInput } from './DateInput'
import { useToast } from './Toast'

type Props = {
  auftrag: Auftrag
  teilauftraege: SubOrderRow[]
  onSuccess: (neuerAuftrag: Auftrag) => void
  onCancel: () => void
}

type Step = 1 | 2

function readableSubOrderType(bereich: string, typ: string | null): string {
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

function formatDetailDimensions(detail: import('../types/database').SubOrderRow['detail']): string {
  const fields = subOrderDetailToFieldMap(detail)
  const widthRaw = fields.format_breite
  const heightRaw = fields.format_hoehe
  const width = typeof widthRaw === 'number' ? widthRaw : typeof widthRaw === 'string' && widthRaw.trim() !== '' ? Number(widthRaw) : null
  const height = typeof heightRaw === 'number' ? heightRaw : typeof heightRaw === 'string' && heightRaw.trim() !== '' ? Number(heightRaw) : null
  const widthValid = width != null && Number.isFinite(width) && width > 0
  const heightValid = height != null && Number.isFinite(height) && height > 0
  const widthText = widthValid ? String(Math.round(width as number)) : ''
  const heightText = heightValid ? String(Math.round(height as number)) : ''
  if (widthValid && heightValid) return `${widthText} × ${heightText} mm`
  if (widthValid) return `${widthText} mm Breite`
  if (heightValid) return `${heightText} mm Höhe`
  return ''
}

export function DuplicateDialog({ auftrag, teilauftraege, onSuccess, onCancel }: Props) {
  const activeSubOrders = useMemo(() => teilauftraege.filter(subOrder => !subOrder.storniert), [teilauftraege])
  const hasMultipleSubOrders = activeSubOrders.length > 1

  const [step, setStep] = useState<Step>(hasMultipleSubOrders ? 1 : 2)
  const [mode, setMode] = useState<'ALL' | 'SELECT'>(hasMultipleSubOrders ? 'ALL' : 'ALL')
  const [selection, setSelection] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const subOrder of activeSubOrders) initial[subOrder.id] = true
    return initial
  })
  const [newDeadline, setNewDeadline] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fehler: toastFehler, erfolg } = useToast()

  const selectedSubOrders = useMemo(() => activeSubOrders.filter(subOrder => selection[subOrder.id]), [activeSubOrders, selection])
  const hasSelection = selectedSubOrders.length >= 1

  const customerLabel = (() => {
    const customer = auftrag.kunden ?? null
    if (!customer) return auftrag.id
    return customerName(customer)
  })()

  const selectAll = () => {
    const next: Record<string, boolean> = {}
    for (const subOrder of activeSubOrders) next[subOrder.id] = true
    setSelection(next)
    setMode('ALL')
    setStep(2)
  }

  const startSelecting = () => {
    setMode('SELECT')
  }

  const goNext = () => {
    if (!hasSelection) return
    setStep(2)
  }

  const toggle = (id: string) => {
    setSelection(previous => ({ ...previous, [id]: !previous[id] }))
  }

  const handleDuplicate = async () => {
    if (busy) return
    if (!hasSelection) return
    setBusy(true)
    setError(null)
    try {
      const { data: newOrderId, error: rpcError } = await supabase.rpc('dupliziere_auftrag', {
        p_auftrag_id: auftrag.id,
        p_prioritaet: auftrag.prioritaet ?? null,
        p_lieferung: auftrag.lieferung ?? null,
        p_termin: newDeadline ? newDeadline : null,
        p_teilauftrag_ids: selectedSubOrders.map(subOrder => subOrder.id),
        p_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      if (rpcError) throw rpcError

      if (typeof newOrderId !== 'string' || newOrderId.trim() === '') {
        toastFehler('Auftrag konnte nicht dupliziert werden')
        return
      }

      const { data: newOrderData, error: loadError } = await supabase
        .from('auftraege')
        .select(ORDER_COLUMNS)
        .eq('id', newOrderId)
        .single()
      if (loadError) throw loadError

      erfolg('Auftrag dupliziert')
      onSuccess(newOrderData as Auftrag)
    } catch (e) {
      toastFehler('Auftrag konnte nicht dupliziert werden')
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cp-modal-bg" role="dialog" aria-modal="true" aria-label="Auftrag duplizieren">
      <div className="cp-modal">
        {step === 1 && (
          <>
            <h3>Welche Teilaufträge übernehmen?</h3>
            <p className="cp-hinweis">Nur aktive (nicht stornierte) Teilaufträge.</p>

            <div className="cp-modal-bar" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <button type="button" className="cp-btn" onClick={selectAll}>
                Alle übernehmen
              </button>
              <button type="button" className="cp-btn" onClick={startSelecting}>
                Auswählen
              </button>
            </div>

            {mode === 'SELECT' && (
              <div className="cp-stack" style={{ marginTop: 12 }}>
                {activeSubOrders.map(subOrder => (
                  <label key={subOrder.id} className="cp-toggle" style={{ alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={!!selection[subOrder.id]} onChange={() => toggle(subOrder.id)} />
                    <span>
                      {(subOrder.bereich in SUB_ORDER_DEPARTMENT_LABELS ? SUB_ORDER_DEPARTMENT_LABELS[subOrder.bereich as keyof typeof SUB_ORDER_DEPARTMENT_LABELS] : subOrderDepartmentLabel(subOrder.bereich))}{' '}
                      · {readableSubOrderType(subOrder.bereich, subOrder.typ)}{' '}
                      {formatDetailDimensions(subOrder.detail) ? `· ${formatDetailDimensions(subOrder.detail)}` : ''}
                    </span>
                  </label>
                ))}
                {!hasSelection && <p className="cp-hinweis">Mindestens 1 Teilauftrag wählen.</p>}
                <div className="cp-modal-bar">
                  <button type="button" className="cp-btn" onClick={onCancel}>
                    Abbrechen
                  </button>
                  <button type="button" className="cp-btn" disabled={!hasSelection} onClick={goNext}>
                    Weiter
                  </button>
                </div>
              </div>
            )}

            {mode === 'ALL' && (
              <div className="cp-modal-bar">
                <button type="button" className="cp-btn" onClick={onCancel}>
                  Abbrechen
                </button>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h3>Auftrag duplizieren</h3>
            <p className="cp-hinweis" style={{ marginTop: 6 }}>
              Kunde: <strong>{customerLabel}</strong>
              <br />
              Teilaufträge: <strong>{selectedSubOrders.length}</strong>
            </p>

            <div style={{ marginTop: 10 }}>
              <p className="cp-hinweis">Neuer Termin (optional)</p>
              <DateInput
                className="cp-select"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                placeholder="Kein Termin — später setzen"
              />
              {!newDeadline && (
                <p className="cp-hinweis" style={{ marginTop: 6 }}>
                  Kein Termin — später setzen
                </p>
              )}
            </div>

            {error && <p className="cp-hinweis" style={{ color: '#b91c1c' }}>{error}</p>}

            <div className="cp-modal-bar" style={{ marginTop: 12 }}>
              <button type="button" className="cp-btn" disabled={busy} onClick={onCancel}>
                Abbrechen
              </button>
              <button type="button" className="cp-btn" disabled={busy || !hasSelection} onClick={() => void handleDuplicate()}>
                Duplizieren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

