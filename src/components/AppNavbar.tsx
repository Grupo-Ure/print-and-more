import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Shirt, Stamp, Users } from 'lucide-react'
import { authService } from '../services/authService'
import { useIsAdmin, useIsSuperAdmin } from '../queries/userQueries'
import { NavbarUserMenu } from './NavbarUserMenu'
import { useNavigation, type AppView } from '../context/navigation.context'
import { cn } from '@/lib/utils'
import logo from '../assets/pam-logo-full.svg'

type NavItem = {
  view: AppView
  label: string
  icon: LucideIcon
}

const ORDERS_ITEM: NavItem = { view: 'orders', label: 'Orders', icon: ClipboardList }

const ADMIN_ITEMS: NavItem[] = [
  { view: 'stampStock', label: 'Stamp stock', icon: Stamp },
  { view: 'textileStock', label: 'Textile stock', icon: Shirt },
]

const SUPER_ADMIN_ITEM: NavItem = { view: 'userManagement', label: 'User management', icon: Users }

function NavbarLink({ item }: { item: NavItem }) {
  const { view, navigate } = useNavigation()
  const isActive = view === item.view
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => navigate(item.view)}
      className={cn(
        'group flex cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-1 text-sm transition-colors',
        isActive
          ? 'border-primary font-medium text-neutral-900'
          : 'border-transparent text-neutral-600 hover:text-neutral-900',
      )}
    >
      <Icon
        className={cn(
          'size-4 transition-colors',
          isActive ? 'text-primary' : 'text-neutral-400 group-hover:text-primary',
        )}
      />
      {item.label}
    </button>
  )
}

function RoleGatedLinks() {
  const { isAdmin } = useIsAdmin()
  const { isSuperAdmin } = useIsSuperAdmin()
  return (
    <>
      {isAdmin && ADMIN_ITEMS.map(item => <NavbarLink key={item.view} item={item} />)}
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
    <nav className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 font-sans">
      <div className="flex items-center justify-start">
        <img src={logo} alt="Print And More" draggable={false} className="h-8 w-auto select-none" />
      </div>
      <div className="flex items-center justify-center gap-1">
        <NavbarLink item={ORDERS_ITEM} />
        <RoleGatedLinks />
      </div>
      <div className="flex justify-end">
        <NavbarUserMenu />
      </div>
    </nav>
  )
}
