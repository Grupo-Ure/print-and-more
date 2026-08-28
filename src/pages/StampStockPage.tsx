import { StockPageShell } from '../components/stock/StockPageShell'
import { StampStockProvider } from '../components/stampStock/StampStockProvider'
import { StampStockView } from '../components/stampStock/StampStockView'

export function StampStockPage() {
  return (
    <StockPageShell accessDeniedDescription="Stamp stock management requires an admin account.">
      {session => (
        <StampStockProvider>
          <StampStockView userId={session.user.id} />
        </StampStockProvider>
      )}
    </StockPageShell>
  )
}
