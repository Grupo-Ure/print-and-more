import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Login } from '../Login'
import { AccessDenied } from '../AccessDenied'
import { useSupabaseSession } from '../../hooks/useSupabaseSession'
import { useIsAdmin } from '../../queries/userQueries'
import { cn } from '@/lib/utils'

type StockPageShellProps = {
  title: string
  accessDeniedDescription: string
  /** Omit for single-view pages — no tab bar is rendered. */
  tabs?: { key: string; label: string }[]
  activeTab?: string
  onTabChange?: (key: string) => void
  /**
   * Pin the page to the viewport height and let the tab content fill the rest,
   * for tabs whose panes scroll independently (instead of the page scrolling).
   */
  fillViewport?: boolean
  /** Content of the active tab; only rendered once the admin gate has passed. */
  children: (session: Session) => ReactNode
}

/**
 * Common frame of the full-page stock views: auth + admin gate, page header
 * with the signed-in user, and the tab bar.
 */
export function StockPageShell({
  title,
  accessDeniedDescription,
  tabs,
  activeTab,
  onTabChange,
  fillViewport = false,
  children,
}: StockPageShellProps) {
  const { session, loading } = useSupabaseSession()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()

  if (loading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description={accessDeniedDescription} />

  return (
    // h-full, not h-screen: the app shell already subtracts the navbar height.
    <div className={cn('mx-auto max-w-6xl p-5', fillViewport && 'flex h-full w-full flex-col')}>
      <h1 className="m-0 text-lg">{title}</h1>

      {tabs && tabs.length > 0 ? (
        <div className="my-3.5 flex flex-wrap gap-2" role="tablist" aria-label={title}>
          {tabs.map(tab => {
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange?.(tab.key)}
                className={cn(
                  'h-8 cursor-pointer rounded-lg border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="my-2" />
      )}

      {fillViewport ? <div className="min-h-0 flex-1">{children(session)}</div> : children(session)}
    </div>
  )
}
