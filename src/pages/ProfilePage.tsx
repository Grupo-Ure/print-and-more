import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { UserAvatar } from '../components/UserAvatar'
import { useCurrentUser } from '../queries/userQueries'
import { ROLE_LABELS } from '../lib/roleLabels'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{value}</span>
    </div>
  )
}

/**
 * The signed-in user's account page. Currently read-only — shows the profile
 * data we have; account settings (avatar, password) will live here later.
 */
export function ProfilePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const session = await authService.getSession()
        if (!alive) return
        setSession(session)
      } finally {
        if (alive) setSessionLoading(false)
      }
    })()
    const { subscription } = authService.onAuthStateChange((_event, newSession) => {
      if (!alive) return
      setSession(newSession)
      // getSession() can stall on supabase's auth lock; the listener always
      // fires INITIAL_SESSION on subscribe, so it also resolves loading.
      setSessionLoading(false)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const { data: user, isLoading: userLoading } = useCurrentUser()

  if (sessionLoading) return null
  if (!session) return <Login />
  if (userLoading || !user) return null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 font-sans text-sm">
      <h1 className="text-lg font-semibold">Profile</h1>

      <section className="rounded-md border border-neutral-200">
        <div className="flex items-center gap-4 p-4">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="size-16 text-2xl" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-foreground">{user.name}</div>
            <div className="truncate text-neutral-500">{user.email}</div>
          </div>
          <Badge
            variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'}
            className="ml-auto shrink-0"
          >
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <Separator />

        <div className="divide-y divide-neutral-100 py-1">
          <ProfileRow label="Name" value={user.name} />
          <ProfileRow label="Email" value={user.email} />
          <ProfileRow label="Role" value={ROLE_LABELS[user.role]} />
          <ProfileRow
            label="Member since"
            value={new Date(user.created_at).toLocaleDateString('en-GB')}
          />
        </div>
      </section>
    </div>
  )
}
