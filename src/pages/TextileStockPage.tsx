import { useState } from 'react'
import { StockPageShell } from '../components/stock/StockPageShell'
import { TextileStockProvider } from '../components/textileStock/TextileStockProvider'
import { TextileMasterData } from '../components/textileStock/TextileMasterData'
import { TextileStockList } from '../components/textileStock/TextileStockList'
import { TextileMovements } from '../components/textileStock/TextileMovements'
import { TextileReorderList } from '../components/textileStock/TextileReorderList'

type Tab = 'PRODUCTS' | 'STOCK' | 'MOVEMENTS' | 'ORDER_LIST'

const TABS: { key: Tab; label: string }[] = [
  { key: 'PRODUCTS', label: 'Products' },
  { key: 'STOCK', label: 'Stock' },
  { key: 'MOVEMENTS', label: 'Movements' },
  { key: 'ORDER_LIST', label: 'Reorder list' },
]

export function TextileStockPage() {
  const [tab, setTab] = useState<Tab>('PRODUCTS')

  return (
    <StockPageShell
      title="Textiles — Stock Management"
      accessDeniedDescription="Stock management requires an admin account."
      tabs={TABS}
      activeTab={tab}
      onTabChange={key => setTab(key as Tab)}
    >
      {session => (
        <TextileStockProvider>
          {tab === 'PRODUCTS' && <TextileMasterData userId={session.user.id} />}
          {tab === 'STOCK' && <TextileStockList userId={session.user.id} />}
          {tab === 'MOVEMENTS' && <TextileMovements />}
          {tab === 'ORDER_LIST' && <TextileReorderList />}
        </TextileStockProvider>
      )}
    </StockPageShell>
  )
}
