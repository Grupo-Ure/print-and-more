import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { authService } from '../services/authService'
import { useCurrentUser } from '../queries/userQueries'
import { ROLE_LABELS } from '../lib/roleLabels'
import { useNavigation } from '../context/navigation.context'
import { UserAvatar } from './UserAvatar'
import { Badge } from '@/components/ui/badge'
import { TEST_IDS } from '@e2e/support/testIds'
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
  const { navigate } = useNavigation()
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
      <DropdownMenuTrigger
        data-testid={TEST_IDS.navbar.userMenu.trigger}
        data-user-email={user.email}
        className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-0.5 text-sm text-neutral-600 transition-colors outline-none select-none hover:text-neutral-900 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-neutral-900"
      >
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
        <span>
          Hi, <span className="font-medium">{firstNameOf(user.name)}</span>
        </span>
        <ChevronDown className="size-3 text-neutral-400 transition-transform group-aria-expanded:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-96" data-testid={TEST_IDS.navbar.userMenu.content}>
        <div className="flex items-center gap-3 px-2 pt-2 pb-1.5">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="size-10 text-lg" />
          <div className="min-w-0">
            <div data-testid={TEST_IDS.navbar.userMenu.name} className="truncate text-xl font-medium text-foreground">
              {user.name}
            </div>
            <div data-testid={TEST_IDS.navbar.userMenu.email} className="truncate text-base text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <Badge
            data-testid={TEST_IDS.navbar.userMenu.role}
            data-role={user.role}
            variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'}
          >
            {ROLE_LABELS[user.role]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Since {new Date(user.created_at).toLocaleDateString('en-GB')}
          </span>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid={TEST_IDS.navbar.userMenu.profile} onSelect={() => navigate('profile')}>
          <Settings className="text-neutral-400" />
          Profile settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid={TEST_IDS.navbar.userMenu.signOut}
          variant="destructive"
          onSelect={() => void signOut()}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-center text-sm text-muted-foreground select-none">
          Print And More v{__APP_VERSION__}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
