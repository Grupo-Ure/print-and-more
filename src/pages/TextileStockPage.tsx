import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StockPageShell } from '../components/stock/StockPageShell'
import { TextileStockProvider } from '../components/textileStock/TextileStockProvider'
import { TextileMasterData } from '../components/textileStock/TextileMasterData'
import { TextileStockList } from '../components/textileStock/TextileStockList'

/** Stock is the page; master data is a subpage behind the cog button. */
type View = 'STOCK' | 'MASTER_DATA'

export function TextileStockPage() {
  const [view, setView] = useState<View>('STOCK')

  return (
    <StockPageShell
      title="Textiles — Stock Management"
      accessDeniedDescription="Stock management requires an admin account."
      fillViewport
    >
      {session => (
        <TextileStockProvider>
          {view === 'STOCK' && (
            <TextileStockList
              userId={session.user.id}
              onOpenMasterData={() => setView('MASTER_DATA')}
            />
          )}
          {view === 'MASTER_DATA' && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-3 flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setView('STOCK')}>
                  <ArrowLeft />
                  Back to stock
                </Button>
                <h2 className="m-0 text-base">Manage brands and products</h2>
              </div>
              <div className="min-h-0 flex-1">
                <TextileMasterData />
              </div>
            </div>
          )}
        </TextileStockProvider>
      )}
    </StockPageShell>
  )
}
