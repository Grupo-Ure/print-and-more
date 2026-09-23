import type { CSSProperties } from 'react'
import { Login } from '../components/Login'
import { ProductionJobPanel } from '../components/production/ProductionJobPanel'
import { ProductionSidebar } from '../components/production/ProductionSidebar'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { TEST_IDS } from '@e2e/support/testIds'

/**
 * The Production page: the back office's view of the work. Same two-column
 * shell as the orders view — a fixed-width sidebar listing every job in
 * pre-press or production across all orders, and the selected job's detail
 * beside it, edited in place.
 */
export function ProductionPage() {
  const { session, loading } = useSupabaseSession()
  // Same fixed widths as the orders view, per breakpoint.
  const isCompact = useIsMobile()

  if (loading) return null
  if (!session) return <Login />

  return (
    <SidebarProvider
      defaultOpen
      style={{ '--sidebar-width': isCompact ? '15rem' : '17.5rem' } as CSSProperties}
      className="h-full min-h-0 font-sans text-sm"
      data-testid={TEST_IDS.production.root}
    >
      <ProductionSidebar currentUserId={session.user.id} />

      <SidebarInset className="flex h-full flex-col overflow-hidden">
        <ProductionJobPanel />
      </SidebarInset>
    </SidebarProvider>
  )
}
