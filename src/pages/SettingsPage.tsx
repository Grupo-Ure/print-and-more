import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Users } from 'lucide-react'
import { Login } from '../components/Login'
import { AccessDenied } from '../components/AccessDenied'
import { DepartmentSettings } from '../components/settings/DepartmentSettings'
import { UserManagementSettings } from '../components/settings/UserManagementSettings'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useIsAdmin, useIsSuperAdmin } from '../queries/userQueries'
import { cn } from '@/lib/utils'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings

export type SettingsSection = 'userManagement' | 'departments'

type SectionItem = {
  section: SettingsSection
  label: string
  icon: LucideIcon
}

const SECTION_ITEMS: SectionItem[] = [
  { section: 'userManagement', label: 'User management', icon: Users },
  { section: 'departments', label: 'Departments', icon: LayoutGrid },
]

/**
 * The Settings page (admins): a fixed section list on the left — plain
 * buttons, nothing collapsible — and the active section on the right.
 * User management stays super-admin only; the rest is for every admin.
 */
export function SettingsPage() {
  const { session, loading: sessionLoading } = useSupabaseSession()
  const { isAdmin, isLoading: roleLoading } = useIsAdmin()
  const { isSuperAdmin } = useIsSuperAdmin()
  const [selected, setSelected] = useState<SettingsSection | null>(null)

  if (sessionLoading) return null
  if (!session) return <Login />
  if (roleLoading) return null
  if (!isAdmin) return <AccessDenied description="Settings require an admin account." />

  const items = SECTION_ITEMS.filter(item => item.section !== 'userManagement' || isSuperAdmin)
  // The first section the role may see, until a click picks another.
  const section = selected ?? items[0].section

  return (
    <div data-testid={IDS.root} className="flex h-full min-h-0 font-sans text-sm">
      <nav
        aria-label="Settings sections"
        className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-neutral-200 bg-neutral-50 p-2 desktop:w-60"
      >
        {items.map(item => (
          <SectionLink
            key={item.section}
            item={item}
            isActive={item.section === section}
            onSelect={() => setSelected(item.section)}
          />
        ))}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-3">
        {section === 'userManagement' && <UserManagementSettings />}
        {section === 'departments' && <DepartmentSettings />}
      </main>
    </div>
  )
}

function SectionLink({
  item,
  isActive,
  onSelect,
}: {
  item: SectionItem
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      data-testid={IDS.sectionLink}
      data-section={item.section}
      aria-current={isActive ? 'page' : undefined}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
        isActive
          ? 'bg-primary/10 font-medium text-neutral-900'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-neutral-400')} />
      {item.label}
    </button>
  )
}
