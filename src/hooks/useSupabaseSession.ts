import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'

/** Current Supabase session plus a loading flag for the initial resolution. */
export function useSupabaseSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const current = await authService.getSession()
        if (!alive) return
        setSession(current)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    const { subscription } = authService.onAuthStateChange((_event, newSession) => {
      if (!alive) return
      setSession(newSession)
      // getSession() can stall on supabase's auth lock; the listener always
      // fires INITIAL_SESSION on subscribe, so it also resolves loading.
      setLoading(false)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
