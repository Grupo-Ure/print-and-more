import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Route, Routes } from 'react-router-dom'
import { supabase } from './supabase'
import { Login } from './components/Login'
import { OrderList } from './components/OrderList'
import { WorkArea } from './components/WorkArea'
import { ContextPanel } from './components/ContextPanel'
import { NeuerAuftragDialog, type NeuerAuftragInsertRow } from './components/NeuerAuftragDialog'
import { KundeDialog } from './components/KundeDialog'
import { kontaktJoinZuKunde } from './lib/kunden'
import type { Kunde } from './lib/kunden'
import type { Auftrag, AuftragStatus, KundeKontaktJoin, TeilauftragRow } from './types/database'
import type { Datei } from './components/DateiListe'
import { BestandspflegeSeite } from './pages/BestandspflegeSeite'

const ORDER_LIST_IN_PLACE_INITIAL: { tick: number; id: string; status: AuftragStatus } = {
  tick: 0,
  id: '',
  status: 'ANGEBOT',
}

function HauptApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)
  const [aktiverAuftragId, setAktiverAuftragId] = useState<string | null>(null)
  const [aktiverAuftrag, setAktiverAuftrag] = useState<Auftrag | null>(null)
  const [aktiverTeilauftrag, setAktiverTeilauftrag] = useState<TeilauftragRow | null>(null)
  const [auftragKunde, setAuftragKunde] = useState<KundeKontaktJoin | null>(null)
  const [auftragDateien, setAuftragDateien] = useState<Datei[]>([])
  const [kontextAktualisiert, setKontextAktualisiert] = useState(0)
  const [orderListKey, setOrderListKey] = useState(0)
  const [orderInPlace, setOrderInPlace] = useState(ORDER_LIST_IN_PLACE_INITIAL)
  const [neuerAuftragOffen, setNeuerAuftragOffen] = useState(false)
  const [kundeDialog, setKundeDialog] = useState<{ offen: boolean; k: Kunde | null }>({
    offen: false,
    k: null,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaden(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    if (aktiverAuftragId == null) {
      setAktiverAuftrag(null)
      setAktiverTeilauftrag(null)
      setAuftragKunde(null)
      setAuftragDateien([])
    }
  }, [aktiverAuftragId])

  const onAuftragVomArbeitsbereich = useCallback((a: Auftrag | null) => {
    setAktiverAuftrag(a)
  }, [])

  const onAuftragKundeGeladen = useCallback((k: KundeKontaktJoin | null) => {
    setAuftragKunde(k)
  }, [])

  const onAktiverTeilauftragGeaendert = useCallback((t: TeilauftragRow | null) => {
    setAktiverTeilauftrag(t)
  }, [])

  const onAuftragDateienGeaendert = useCallback((d: Datei[]) => {
    setAuftragDateien(d)
  }, [])

  const handleAuftragAktualisiert = useCallback((a: Auftrag) => {
    setAktiverAuftrag(a)
    if (a.archiviert) {
      setAktiverAuftragId(null)
      setOrderListKey(k => k + 1)
      setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    } else {
      setOrderInPlace(p => ({ tick: p.tick + 1, id: a.id, status: a.status }))
    }
    setKontextAktualisiert(x => x + 1)
  }, [])

  const handleAuftragGeloescht = useCallback((_auftragId: string) => {
    setAktiverAuftragId(null)
    setAktiverTeilauftrag(null)
    setOrderListKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setKontextAktualisiert(x => x + 1)
  }, [])

  const handleTeilauftragAktualisiert = useCallback((t: TeilauftragRow) => {
    setAktiverTeilauftrag(t)
    setKontextAktualisiert(x => x + 1)
  }, [])

  const handleTeilauftragEntfernt = useCallback((entferntId: string) => {
    setAktiverTeilauftrag(cur => (cur?.id === entferntId ? null : cur))
    setKontextAktualisiert(x => x + 1)
  }, [])

  const handleKundeGespeichert = useCallback((_: Kunde) => {
    setKundeDialog({ offen: false, k: null })
    setOrderListKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
    setKontextAktualisiert(x => x + 1)
  }, [])

  const handleNeuerAuftragErfolg = useCallback((a: NeuerAuftragInsertRow) => {
    setNeuerAuftragOffen(false)
    setAktiverAuftragId(a.id)
    setOrderListKey(k => k + 1)
    setOrderInPlace(ORDER_LIST_IN_PLACE_INITIAL)
  }, [])

  const openKundeBearbeiten = useCallback(() => {
    const k = kontaktJoinZuKunde(auftragKunde)
    if (k) setKundeDialog({ offen: true, k })
  }, [auftragKunde])

  if (laden) return null
  if (!session) return <Login />

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      <div
        className="app-col"
        style={{ borderRight: '1px solid #e5e5e5', background: '#fafafa' }}
      >
        <OrderList
          key={orderListKey}
          orderInPlace={orderInPlace}
          aktiverAuftragId={aktiverAuftragId}
          onAuftragWaehlen={id => setAktiverAuftragId(id)}
          onNeuerAuftrag={() => setNeuerAuftragOffen(true)}
        />
      </div>
      <div className="app-col">
        <WorkArea
          aktiverAuftragId={aktiverAuftragId}
          kontextAktualisiert={kontextAktualisiert}
          onAktiverTeilauftragGeaendert={onAktiverTeilauftragGeaendert}
          onAuftragKundeGeladen={onAuftragKundeGeladen}
          onAuftragVomArbeitsbereich={onAuftragVomArbeitsbereich}
          onAuftragDateienGeaendert={onAuftragDateienGeaendert}
          onAuftragAktualisiert={handleAuftragAktualisiert}
          onKundeBearbeiten={openKundeBearbeiten}
        />
      </div>
      <div
        className="app-col"
        style={{
          borderLeft: '1px solid #e5e5e5',
          background: '#fafafa',
          padding: 16,
        }}
      >
        <ContextPanel
          auftrag={aktiverAuftrag}
          aktiverTeilauftrag={aktiverTeilauftrag}
          auftragKunde={auftragKunde}
          auftragDateien={auftragDateien}
          onAuftragAktualisiert={handleAuftragAktualisiert}
          onAuftragGeloescht={handleAuftragGeloescht}
          onTeilauftragAktualisiert={handleTeilauftragAktualisiert}
          onTeilauftragEntfernt={handleTeilauftragEntfernt}
          onKundeBearbeiten={openKundeBearbeiten}
          kontextAktualisiert={kontextAktualisiert}
        />
      </div>

      <NeuerAuftragDialog
        offen={neuerAuftragOffen}
        onSchliessen={() => setNeuerAuftragOffen(false)}
        onErfolg={handleNeuerAuftragErfolg}
      />
      {kundeDialog.offen && (
        <KundeDialog
          kunde={kundeDialog.k}
          onGespeichert={handleKundeGespeichert}
          onAbbrechen={() => setKundeDialog({ offen: false, k: null })}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HauptApp />} />
      <Route path="/bestandspflege" element={<BestandspflegeSeite />} />
    </Routes>
  )
}

export default App
