import { useState } from 'react'
import { StockPageShell } from '../components/stock/StockPageShell'
import { StampStockProvider } from '../components/stampStock/StampStockProvider'
import { StampOverview } from '../components/stampStock/StampOverview'
import { StampMasterData } from '../components/stampStock/StampMasterData'
import { StampMovements } from '../components/stampStock/StampMovements'
import { StampReorderList } from '../components/stampStock/StampReorderList'

type Tab = 'OVERVIEW' | 'PRODUCTS' | 'MOVEMENTS' | 'ORDER_LIST'

const TABS: { key: Tab; label: string }[] = [
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'PRODUCTS', label: 'Products' },
  { key: 'MOVEMENTS', label: 'Movements' },
  { key: 'ORDER_LIST', label: 'Reorder list' },
]

export function StampStockPage() {
  const [tab, setTab] = useState<Tab>('OVERVIEW')

  return (
    <StockPageShell
      title="Stamp — Stock Management"
      accessDeniedDescription="Stamp stock management requires an admin account."
      tabs={TABS}
      activeTab={tab}
      onTabChange={key => setTab(key as Tab)}
    >
      {session => (
        <StampStockProvider>
          {tab === 'OVERVIEW' && <StampOverview userId={session.user.id} />}
          {tab === 'PRODUCTS' && <StampMasterData />}
          {tab === 'MOVEMENTS' && <StampMovements />}
          {tab === 'ORDER_LIST' && <StampReorderList />}
        </StampStockProvider>
      )}
    </StockPageShell>
  )
}
