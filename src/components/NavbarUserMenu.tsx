import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { authService } from '../services/authService'
import { useCurrentUser } from '../queries/userQueries'
import { ROLE_LABELS } from '../lib/roleLabels'
import { UserAvatar } from './UserAvatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/**
 * Navbar user section: avatar + greeting as a trigger for the account menu
 * (identity card, profile settings, sign out).
 */
export function NavbarUserMenu() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()

  if (!user) return null

  const signOut = async () => {
    await authService.signOut()
    // Drop every cached query so nothing from this account survives into the
    // next session (the auth listener swaps the app to the login screen).
    queryClient.clear()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-0.5 text-sm text-neutral-600 transition-colors outline-none select-none hover:text-neutral-900 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-neutral-900">
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
        <span>
          Hi, <span className="font-medium">{firstNameOf(user.name)}</span>
        </span>
        <ChevronDown className="size-3 text-neutral-400 transition-transform group-aria-expanded:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <div className="flex items-center gap-3 px-2 pt-2 pb-1.5">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="size-10 text-lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <Badge variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'}>
            {ROLE_LABELS[user.role]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Since {new Date(user.created_at).toLocaleDateString('en-GB')}
          </span>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <Settings className="text-neutral-400" />
          Profile settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
