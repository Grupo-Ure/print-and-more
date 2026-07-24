import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Shirt, Stamp, Users } from 'lucide-react'
import { authService } from '../services/authService'
import { useIsAdmin, useIsSuperAdmin } from '../queries/userQueries'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const ORDERS_ITEM: NavItem = { to: '/', label: 'Orders', icon: ClipboardList, end: true }

const ADMIN_ITEMS: NavItem[] = [
  { to: '/stamp-stock', label: 'Stamp stock', icon: Stamp },
  { to: '/textile-stock', label: 'Textile stock', icon: Shirt },
]

const SUPER_ADMIN_ITEM: NavItem = { to: '/user-management', label: 'User management', icon: Users }

function NavbarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-1.5 border-b-2 px-2.5 py-1 text-sm transition-colors',
          isActive
            ? 'border-primary font-medium text-neutral-900'
            : 'border-transparent text-neutral-600 hover:text-neutral-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'size-4 transition-colors',
              isActive ? 'text-primary' : 'text-neutral-400 group-hover:text-primary',
            )}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function RoleGatedLinks() {
  const { isAdmin } = useIsAdmin()
  const { isSuperAdmin } = useIsSuperAdmin()
  return (
    <>
      {isAdmin && ADMIN_ITEMS.map(item => <NavbarLink key={item.to} item={item} />)}
      {isSuperAdmin && <NavbarLink item={SUPER_ADMIN_ITEM} />}
    </>
  )
}

export function AppNavbar() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    authService
      .getSession()
      .then(setSession)
      .catch(() => setSession(null))
    const { subscription } = authService.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!session) return null

  return (
    <nav className="flex shrink-0 items-center justify-center gap-1 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 font-sans">
      <NavbarLink item={ORDERS_ITEM} />
      <RoleGatedLinks />
    </nav>
  )
}
