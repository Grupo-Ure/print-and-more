import { useState } from 'react'
import { Login } from '../components/Login'
import { AccessDenied } from '../components/AccessDenied'
import { StampStockProvider } from '../components/stampStock/StampStockProvider'
import { StampOverview } from '../components/stampStock/StampOverview'
import { StampMovements } from '../components/stampStock/StampMovements'
import { StampReorderList } from '../components/stampStock/StampReorderList'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useIsAdmin } from '../queries/userQueries'

type Tab = 'OVERVIEW' | 'MOVEMENTS' | 'ORDER_LIST'

export function StampStockPage() {
  const { session, loading } = useSupabaseSession()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()
  const [tab, setTab] = useState<Tab>('OVERVIEW')

  if (loading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description="Stamp stock management requires an admin account." />

  const userEmail = session.user?.email ?? session.user?.id ?? ''

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Stamp — Stock Management</h1>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{userEmail}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, marginBottom: 14 }}>
        <button
          type="button"
          className={tab === 'OVERVIEW' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('OVERVIEW')}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === 'MOVEMENTS' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('MOVEMENTS')}
        >
          Movements
        </button>
        <button
          type="button"
          className={tab === 'ORDER_LIST' ? 'cp-btn' : 'cp-btn cp-btn-grau'}
          onClick={() => setTab('ORDER_LIST')}
        >
          Reorder list
        </button>
      </div>

      <StampStockProvider>
        {tab === 'OVERVIEW' && <StampOverview userId={session.user.id} />}
        {tab === 'MOVEMENTS' && <StampMovements />}
        {tab === 'ORDER_LIST' && <StampReorderList />}
      </StampStockProvider>
    </div>
  )
}
