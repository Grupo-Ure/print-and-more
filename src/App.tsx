import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { Login } from './components/Login'
import { OrderList } from './components/OrderList'
import { WorkArea } from './components/WorkArea'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [laden, setLaden] = useState(true)
  const [aktiverAuftragId, setAktiverAuftragId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaden(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (laden) return null
  if (!session) return <Login />

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr 260px',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
    }}>
      <div style={{ borderRight: '1px solid #e5e5e5', overflowY: 'auto', background: '#fafafa' }}>
        <OrderList
          aktiverAuftragId={aktiverAuftragId}
          onAuftragWaehlen={id => setAktiverAuftragId(id)}
        />
      </div>
      <div style={{ overflowY: 'auto' }}>
        <WorkArea aktiverAuftragId={aktiverAuftragId} />
      </div>
      <div style={{ borderLeft: '1px solid #e5e5e5', overflowY: 'auto', background: '#fafafa', padding: 16 }}>
        <p style={{ fontSize: 13, color: '#888' }}>Status & Aktionen</p>
      </div>
    </div>
  )
}

export default App