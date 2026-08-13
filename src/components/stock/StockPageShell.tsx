import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Login } from '../Login'
import { AccessDenied } from '../AccessDenied'
import { useSupabaseSession } from '../../hooks/useSupabaseSession'
import { useIsAdmin } from '../../queries/userQueries'

type StockPageShellProps = {
  accessDeniedDescription: string
  /** Page content; only rendered once the admin gate has passed. */
  children: (session: Session) => ReactNode
}

/**
 * Common frame of the full-page stock views: auth + admin gate and the page
 * padding. No page title — the navbar tab already names the page. The page
 * flows and scrolls normally; the views' toolbars and table headers pin to
 * the app's scroll area (only dialogs scroll internally).
 */
export function StockPageShell({ accessDeniedDescription, children }: StockPageShellProps) {
  const { session, loading } = useSupabaseSession()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()

  if (loading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description={accessDeniedDescription} />

  // No top padding here: the sticky StockToolbar carries it inside its own
  // box, so its rest position equals its pinned position and there is no
  // visible "travel" before the sticky settles when scrolling starts.
  return <main className="w-full px-3 pb-3">{children(session)}</main>
}
