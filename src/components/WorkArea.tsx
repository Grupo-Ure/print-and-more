import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { customerName } from '../lib/customer'
import { synchronizeOrderStatus } from '../lib/orderStatus'
import { departmentAbbreviation } from '../const/departmentAbbreviation'
import { ORDER_COLUMNS } from '../const/orderSelect'
import { SUB_ORDER_COLUMNS } from '../const/subOrderSelect'
import {
  teilauftragBereichLabel,
  type Auftrag,
  type AuftragDetailRow,
  type AuftragStatus,
  type Bereich,
  type KundeKontaktJoin,
  type KundeKontaktRow,
  type LieferungWahl,
  type Prioritaet,
  type TeilauftragRow,
} from '../types/database'
import { useToast } from './Toast'
import { AddSubOrderOverlay } from './AddSubOrderOverlay'
import { DateInput } from './DateInput'
import type { FileRecord } from './FileList'
import { SubOrderDetail } from './SubOrderDetail'
import './WorkArea.css'

function ersteKontaktZeile(k: KundeKontaktJoin | null): KundeKontaktRow | null {
  if (k == null) return null
  const z = Array.isArray(k) ? (k[0] ?? null) : k
  return z ?? null
}

/** Eine Zeile für den Header: E-Mail bevorzugt, sonst Telefon. */
function kundeKontaktEineLinie(k: KundeKontaktJoin | null): string {
  const row = ersteKontaktZeile(k)
  if (!row) return ''
  const mail = row.email?.trim() ?? ''
  if (mail !== '') return mail
  return row.telefon?.trim() ?? ''
}

function teilStatusDotClass(s: AuftragStatus): string {
  switch (s) {
    case 'ANGEBOT':
      return 'td-dot td-dot--grau'
    case 'UNVOLLSTAENDIG':
      return 'td-dot td-dot--orange'
    case 'PREPRESS_BEREIT':
      return 'td-dot td-dot--blau'
    case 'PRODUKTION_BEREIT':
      return 'td-dot td-dot--lila'
    case 'FERTIG':
      return 'td-dot td-dot--gruen'
    default:
      return 'td-dot td-dot--grau'
  }
}

type Props = {
  activeOrderId: string | null
  contextRefreshTick: number
  onActiveSubOrderChanged: (t: TeilauftragRow | null) => void
  onOrderCustomerLoaded: (k: KundeKontaktJoin | null) => void
  onOrderFromWorkArea: (a: Auftrag | null) => void
  onOrderFilesChanged: (d: FileRecord[]) => void
  onOrderUpdated: (a: Auftrag) => void
  onEditCustomer: () => void
}

export function WorkArea({
  activeOrderId,
  contextRefreshTick,
  onActiveSubOrderChanged,
  onOrderCustomerLoaded,
  onOrderFromWorkArea,
  onOrderFilesChanged,
  onOrderUpdated,
  onEditCustomer,
}: Props) {
  const [auftrag, setAuftrag] = useState<AuftragDetailRow | null>(null)
  const [teilauftraege, setTeilauftraege] = useState<TeilauftragRow[]>([])
  const [aktiverTeilauftragId, setAktiverTeilauftragId] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [overlayOffen, setOverlayOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)
  const [dateien, setFiles] = useState<FileRecord[]>([])
  const [kopfTermin, setKopfTermin] = useState('')
  const [kopfLieferung, setKopfLieferung] = useState<LieferungWahl | ''>('')
  const [kopfPrioritaet, setKopfPrioritaet] = useState<Prioritaet>('NORMAL')
  const [verantwortlicherName, setVerantwortlicherName] = useState<string | null>(null)
  const kopfSnap = useRef<{
    termin: string | null
    lieferung: LieferungWahl | null
    prioritaet: Prioritaet
  }>({ termin: null, lieferung: null, prioritaet: 'NORMAL' })
  const { fehler: toastFehler } = useToast()
  const ladeAuftragRequestIdRef = useRef(0)

  const reloadFiles = useCallback(async () => {
    if (!activeOrderId) return
    const { data, error } = await supabase
      .from('dateien')
      .select('id, anzeigename, pfad, rolle, erstellt_am')
      .eq('auftrag_id', activeOrderId)
      .order('erstellt_am', { ascending: true })
    if (error) {
      setFiles([])
      toastFehler('Dateien konnten nicht geladen werden')
    } else {
      setFiles((data ?? []) as FileRecord[])
    }
  }, [activeOrderId, toastFehler])

  useEffect(() => {
    if (!activeOrderId) {
      setFiles([])
      return
    }
    void reloadFiles()
  }, [activeOrderId, contextRefreshTick, reloadFiles])

  useEffect(() => {
    if (!activeOrderId) {
      setAuftrag(null)
      setTeilauftraege([])
      setAktiverTeilauftragId(null)
      setFehler(null)
      setLaden(false)
      return
    }

    const meineRequestId = ++ladeAuftragRequestIdRef.current
    const isStale = () => meineRequestId !== ladeAuftragRequestIdRef.current
    const auftragId = activeOrderId

    const laden = async () => {
      setFehler(null)
      setLaden(true)
      try {
        const [aufRes, tRes] = await Promise.all([
          supabase
            .from('auftraege')
            .select(ORDER_COLUMNS)
            .eq('id', auftragId)
            .single(),
          supabase
            .from('teilauftraege')
            .select(SUB_ORDER_COLUMNS)
            .eq('auftrag_id', auftragId)
            .order('id', { ascending: true }),
        ])
        if (isStale()) return

        if (aufRes.error) {
          if (isStale()) return
          setFehler(aufRes.error.message)
          toastFehler('Auftrag konnte nicht geladen werden')
          setAuftrag(null)
          setTeilauftraege([])
          setAktiverTeilauftragId(null)
          return
        }
        if (tRes.error) {
          if (isStale()) return
          setFehler(tRes.error.message)
          toastFehler('Auftrag konnte nicht geladen werden')
          setAuftrag(aufRes.data as AuftragDetailRow)
          setTeilauftraege([])
          setAktiverTeilauftragId(null)
          return
        }

        if (isStale()) return
        setAuftrag(aufRes.data as AuftragDetailRow)
        const teile = tRes.data ?? []
        setTeilauftraege(teile)
        setAktiverTeilauftragId(t => {
          const sichtbar = teile.filter(x => !x.storniert)
          if (t && sichtbar.some(x => x.id === t)) return t
          return sichtbar[0]?.id ?? null
        })
      } catch (err) {
        if (isStale()) return
        setFehler(err instanceof Error ? err.message : String(err))
        toastFehler('Auftrag konnte nicht geladen werden')
        setAuftrag(null)
        setTeilauftraege([])
        setAktiverTeilauftragId(null)
      } finally {
        if (!isStale()) {
          setLaden(false)
        }
      }
    }

    void laden()
    return () => {}
  }, [activeOrderId, contextRefreshTick, toastFehler])

  useEffect(() => {
    if (!auftrag) return
    const raw = auftrag.termin
    const iso =
      raw && raw.length > 0
        ? raw.length > 10
          ? raw.slice(0, 10)
          : raw
        : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Formular spiegelt Server-Zeile
    setKopfTermin(iso)
    setKopfLieferung(auftrag.lieferung ?? '')
    setKopfPrioritaet(auftrag.prioritaet)
    kopfSnap.current = {
      termin: raw,
      lieferung: auftrag.lieferung,
      prioritaet: auftrag.prioritaet,
    }
  }, [auftrag])

  const speichereAuftragKopf = useCallback(
    async (patch: Partial<Pick<AuftragDetailRow, 'termin' | 'lieferung' | 'prioritaet'>>) => {
      if (!activeOrderId) return
      const { data, error } = await supabase
        .from('auftraege')
        .update(patch)
        .eq('id', activeOrderId)
        .select(ORDER_COLUMNS)
        .single()
      if (error) {
        toastFehler('Auftrag konnte nicht gespeichert werden')
        return
      }
      if (data) {
        const row = data as AuftragDetailRow
        setAuftrag(row)
        onOrderFromWorkArea(row)
        onOrderCustomerLoaded(row.kunden)
        kopfSnap.current = {
          termin: row.termin,
          lieferung: row.lieferung,
          prioritaet: row.prioritaet,
        }
      }
    },
    [activeOrderId, onOrderFromWorkArea, onOrderCustomerLoaded, toastFehler]
  )

  const sichtbareTeile = useMemo(
    () => teilauftraege.filter(t => !t.storniert),
    [teilauftraege]
  )
  const aktiverTeilFuerKontext = useMemo((): TeilauftragRow | null => {
    if (aktiverTeilauftragId == null) return null
    return sichtbareTeile.find(t => t.id === aktiverTeilauftragId) ?? null
  }, [sichtbareTeile, aktiverTeilauftragId])

  useEffect(() => {
    const vid = aktiverTeilFuerKontext?.verantwortlicher_id ?? null
    if (!vid) {
      setVerantwortlicherName(null)
      return
    }
    let alive = true
    void (async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('id, name')
        .eq('id', vid)
        .single()
      if (!alive) return
      if (error) {
        console.error(error)
        return
      }
      const row = data as { name: string | null } | null
      setVerantwortlicherName(row?.name ?? null)
    })()
    return () => {
      alive = false
    }
  }, [aktiverTeilFuerKontext?.verantwortlicher_id])

  const handhabeTeilAktualisiert = useCallback(
    (t: TeilauftragRow) => {
      setTeilauftraege(list => list.map(x => (x.id === t.id ? t : x)))
      onActiveSubOrderChanged(t)
    },
    [onActiveSubOrderChanged]
  )

  useEffect(() => {
    if (activeOrderId == null) {
      onOrderFromWorkArea(null)
      onOrderCustomerLoaded(null)
      onActiveSubOrderChanged(null)
      onOrderFilesChanged([])
      return
    }
    if (laden || !auftrag || auftrag.id !== activeOrderId) return
    onOrderFromWorkArea(auftrag)
    onOrderCustomerLoaded(auftrag.kunden)
    onActiveSubOrderChanged(aktiverTeilFuerKontext)
    onOrderFilesChanged(dateien)
  }, [
    activeOrderId,
    laden,
    auftrag,
    dateien,
    aktiverTeilFuerKontext,
    onOrderFromWorkArea,
    onOrderCustomerLoaded,
    onActiveSubOrderChanged,
    onOrderFilesChanged,
  ])

  const handleNeuerTeilauftrag = async (bereich: Bereich) => {
    if (!activeOrderId || !auftrag) return
    setSpeichert(true)
    setFehler(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setFehler('Nicht angemeldet')
      setSpeichert(false)
      return
    }
    const heute = new Date()
    const terminIso = auftrag.termin
      ? auftrag.termin.length > 10
        ? auftrag.termin.slice(0, 10)
        : auftrag.termin
      : `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`
    const priorVal = auftrag.prioritaet
    const lief = auftrag.lieferung ?? 'ABHOLUNG'
    const { data, error } = await supabase
      .from('teilauftraege')
      .insert({
        auftrag_id: activeOrderId,
        bereich,
        status: 'UNVOLLSTAENDIG',
        prioritaet: priorVal,
        detail: {},
        termin: terminIso,
        lieferung: lief,
        verantwortlicher_id: user.id,
        notfall_aktiv: false,
        notfall_begruendung: null,
        storniert: false,
        kundenfreigabe_erforderlich: false,
        kundenfreigabe_liegt_vor: false,
        kundenfreigabe_datei_id: null,
      })
      .select(SUB_ORDER_COLUMNS)
      .single()

    setSpeichert(false)
    if (error) {
      setFehler(error.message)
      return
    }
    if (data) {
      setTeilauftraege(list => {
        const next = [...list, data as TeilauftragRow].sort((a, b) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0
        )
        return next
      })
      setAktiverTeilauftragId(data.id)

      try {
        const a = await synchronizeOrderStatus(auftrag.id)
        setAuftrag(prev => (prev ? { ...prev, status: a.status } : prev))
        onOrderUpdated({ ...auftrag, status: a.status })
      } catch {
        toastFehler('Auftragsstatus konnte nicht aktualisiert werden')
        const { data: refreshed } = await supabase
          .from('auftraege')
          .select(ORDER_COLUMNS)
          .eq('id', auftrag.id)
          .single()
        if (refreshed) {
          setAuftrag(refreshed as AuftragDetailRow)
          onOrderUpdated(refreshed as Auftrag)
        }
      }
    }
    setOverlayOffen(false)
  }

  if (!activeOrderId) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-hint">Wählen Sie links einen Auftrag aus, um Details und Teilaufträge zu bearbeiten.</p>
      </div>
    )
  }

  if (laden) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-laden">Lädt Auftrag …</p>
      </div>
    )
  }

  if (fehler && !auftrag) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-fehler">{fehler}</p>
      </div>
    )
  }

  if (!auftrag) {
    return (
      <div className="work-area work-area--empty">
        <p className="wa-hint">Auftrag nicht gefunden.</p>
      </div>
    )
  }

  const kunde = customerName(auftrag.kunden)
  const aktiverTeil = aktiverTeilFuerKontext
  const termSlice = (t: string | null) => (t && t.length > 10 ? t.slice(0, 10) : t || '')
  const kontaktEineZeile = kundeKontaktEineLinie(auftrag.kunden)

  const prioritaetGlyph = (p: Prioritaet) => (p === 'HOCH' ? '▲' : '●')

  return (
    <div className="work-area">
      <header
        className="work-area__header"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px 12px',
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <h1 className="work-area__kunde" style={{ margin: 0 }}>
              {kunde}
            </h1>
            <span className="work-area__auftragsnummer">{auftrag.auftragsnummer}</span>
            <button
              type="button"
              className="wa-gear"
              style={{ marginLeft: 0 }}
              onClick={onEditCustomer}
              title="Kunde bearbeiten"
              aria-label="Kunde bearbeiten"
            >
              <span className="wa-gear-ico" aria-hidden>
                ⚙
              </span>
            </button>
          </div>
          <div className="work-area__verantwortlich" aria-hidden style={{ flexShrink: 0, textAlign: 'right' }}>
            {verantwortlicherName ?? ''}
          </div>
        </div>
        {kontaktEineZeile ? (
          <div
            style={{
              width: '100%',
              fontSize: 12,
              color: '#6b7280',
              lineHeight: 1.35,
            }}
          >
            <span style={{ minWidth: 0 }} title={kontaktEineZeile}>
              {kontaktEineZeile}
            </span>
          </div>
        ) : null}
      </header>

      {fehler && <p className="wa-fehler">{fehler}</p>}

      <section className="work-area__meta" aria-label="Auftrags-Meta">
        <label className="meta-pill" title="Termin">
          <span aria-hidden>📅</span>
          <DateInput
            value={kopfTermin}
            onChange={e => setKopfTermin(e.target.value)}
            onBlur={e => {
              const v = e.target.value || null
              const s = termSlice(kopfSnap.current.termin)
              if ((v || '') !== (s || '')) {
                void speichereAuftragKopf({ termin: v })
              }
            }}
          />
        </label>
        <label className="meta-pill" title="Lieferung">
          <span aria-hidden>🚚</span>
          <select
            value={kopfLieferung}
            onChange={e => {
              const v = e.target.value
              const liefer: LieferungWahl | null = v === 'ABHOLUNG' || v === 'VERSAND' ? v : null
              setKopfLieferung(liefer ?? '')
              if (liefer !== kopfSnap.current.lieferung) {
                void speichereAuftragKopf({ lieferung: liefer })
              }
            }}
          >
            <option value="">—</option>
            <option value="ABHOLUNG">Abholung</option>
            <option value="VERSAND">Versand</option>
          </select>
        </label>
        <label className="meta-pill" title="Priorität">
          <span className="wa-prio-glyph" aria-hidden>
            {prioritaetGlyph(kopfPrioritaet)}
          </span>
          <select
            value={kopfPrioritaet}
            onChange={e => {
              const v = e.target.value
              if (v === 'NORMAL' || v === 'HOCH') {
                setKopfPrioritaet(v)
                if (v !== kopfSnap.current.prioritaet) {
                  void speichereAuftragKopf({ prioritaet: v })
                }
              }
            }}
          >
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>
        </label>
      </section>

      <div className="work-area__tabs" role="tablist" aria-label="Teilaufträge">
        {sichtbareTeile.map(t => {
          const active = t.id === aktiverTeilauftragId
          const bkz = departmentAbbreviation(t.bereich)
          const ttitle = `${teilauftragBereichLabel(t.bereich)} · ${t.status}`
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={active ? 'tab-btn tab-btn--active' : 'tab-btn'}
              aria-selected={active}
              onClick={() => setAktiverTeilauftragId(t.id)}
              title={ttitle}
            >
              <span className="wa-tab-kz">{bkz}</span>
              <span className="wa-tab-sep" aria-hidden>
                {' '}
                ·{' '}
              </span>
              <span
                className={teilStatusDotClass(t.status)}
                title={t.status}
                aria-label={t.status}
              />
            </button>
          )
        })}
        <button
          type="button"
          className="tab-add-btn"
          onClick={() => setOverlayOffen(true)}
          aria-label="Teilauftrag hinzufügen"
        >
          +
        </button>
      </div>

      <div className="work-area__formular" role="tabpanel">
        {aktiverTeil ? (
          <SubOrderDetail
            subOrder={aktiverTeil}
            orderStatus={auftrag.status}
            orderDeadline={auftrag.termin}
            orderDelivery={auftrag.lieferung}
            orderPriority={auftrag.prioritaet}
            orderCustomer={auftrag.kunden}
            orderFiles={dateien}
            onUpdated={handhabeTeilAktualisiert}
          />
        ) : (
          <p className="wa-hint">Noch keine Teilaufträge. Nutzen Sie +, um einen Bereich anzulegen.</p>
        )}
      </div>

      <AddSubOrderOverlay
        open={overlayOffen}
        saving={speichert}
        onBereichSelected={handleNeuerTeilauftrag}
        onClose={() => !speichert && setOverlayOffen(false)}
      />
    </div>
  )
}
