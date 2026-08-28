import { useEffect, useState, type CSSProperties } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { OrderSidebar } from '../components/OrderSidebar'
import { OrderDetails } from '../components/OrderDetails'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { OrderWorkspaceProvider } from '../context/order.context'

export function OrderWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService
      .getSession()
      .then(session => {
        setSession(session)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    // Also resolves loading: getSession() can stall on supabase's auth lock
    // (orphaned by StrictMode double-mounts), while the listener always fires
    // INITIAL_SESSION on subscribe.
    const { subscription } = authService.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Login />

  return (
    <OrderWorkspaceProvider>
      <WorkspaceShell />
    </OrderWorkspaceProvider>
  )
}

function WorkspaceShell() {
  // Fixed sidebar width per breakpoint — never content-driven, just narrower
  // on small laptops. Same breakpoint as the `desktop:` Tailwind variant.
  const isCompact = useIsMobile()

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': isCompact ? '15rem' : '17.5rem' } as CSSProperties}
      className="h-full min-h-0 font-sans text-sm"
    >
      <OrderSidebar />

      <SidebarInset className="flex flex-col h-full overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <OrderDetails />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
