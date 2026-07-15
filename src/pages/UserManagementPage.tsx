import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import {
  useCreateUser,
  useCurrentUser,
  useDeleteUser,
  useUpdateUserRole,
  useUsers,
} from '../queries/userQueries'
import type { UserRow } from '../services/userService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLE_LABELS: Record<UserRow['role'], string> = {
  EMPLOYEE: 'Employee',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
}

type ManagedRole = 'EMPLOYEE' | 'ADMIN'

const CREATE_FORM_INITIAL = { email: '', password: '', name: '', role: 'EMPLOYEE' as ManagedRole }

export function UserManagementPage() {
  const { showError, showSuccess } = useToast()
  const confirm = useConfirm()
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
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: users, isLoading: usersLoading } = useUsers()
  const updateRole = useUpdateUserRole()
  const createUser = useCreateUser()
  const deleteUser = useDeleteUser()

  const [createForm, setCreateForm] = useState(CREATE_FORM_INITIAL)

  if (sessionLoading) return null
  if (!session) return <Login />
  if (currentUserLoading) return null

  const callerRole = currentUser?.role
  const isSuperAdmin = callerRole === 'SUPER_ADMIN'
  const isAdmin = callerRole === 'ADMIN' || isSuperAdmin

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 font-sans">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="text-sm text-neutral-500">User management requires an admin account.</p>
        <Link to="/" className="text-sm underline">
          Back to orders
        </Link>
      </div>
    )
  }

  // UX gating only — the DB triggers and the Edge Function enforce the matrix.
  const canChangeRole = (target: UserRow) =>
    isSuperAdmin && target.role !== 'SUPER_ADMIN' && target.id !== currentUser?.id
  const canDelete = (target: UserRow) =>
    target.role !== 'SUPER_ADMIN' &&
    target.id !== currentUser?.id &&
    (isSuperAdmin || target.role === 'EMPLOYEE')

  const handleRoleChange = (target: UserRow, role: ManagedRole) => {
    updateRole.mutate(
      { id: target.id, role },
      {
        onSuccess: () => showSuccess(`${target.name} is now ${ROLE_LABELS[role]}`),
        onError: err => showError(err.message),
      },
    )
  }

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    createUser.mutate(createForm, {
      onSuccess: user => {
        showSuccess(`Account for ${user.name} created`)
        setCreateForm(CREATE_FORM_INITIAL)
      },
      onError: err => showError(err.message),
    })
  }

  const handleDelete = async (user: UserRow) => {
    const confirmed = await confirm({
      title: 'Delete account',
      description: `Delete the account of ${user.name} (${user.email})? Their entries in history and stock movements are kept without a user reference.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    deleteUser.mutate(user.id, {
      onSuccess: () => showSuccess(`Account of ${user.name} deleted`),
      onError: err => showError(err.message),
    })
  }

  return (
    <div className="mx-auto flex h-screen max-w-4xl flex-col gap-6 overflow-y-auto p-6 font-sans text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">User management</h1>
        <Link to="/" className="text-sm underline">
          Back to orders
        </Link>
      </div>

      <section className="rounded-md border border-neutral-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-neutral-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  {user.name}
                  {user.id === currentUser?.id && (
                    <span className="ml-1 text-neutral-400">(you)</span>
                  )}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {canChangeRole(user) ? (
                    <Select
                      value={user.role}
                      disabled={updateRole.isPending}
                      onValueChange={next => {
                        if (next === 'EMPLOYEE' || next === 'ADMIN') handleRoleChange(user, next)
                      }}
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</SelectItem>
                        <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString('en-GB')}</TableCell>
                <TableCell className="text-right">
                  {canDelete(user) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteUser.isPending}
                      onClick={() => void handleDelete(user)}
                    >
                      Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-3 text-base font-semibold">Create account</h2>
        <form className="grid grid-cols-2 gap-3" onSubmit={handleCreate}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-user-name">Name</Label>
            <Input
              id="new-user-name"
              required
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              required
              value={createForm.email}
              onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-user-password">Initial password</Label>
            <Input
              id="new-user-password"
              type="password"
              required
              minLength={6}
              value={createForm.password}
              onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Role</Label>
            {isSuperAdmin ? (
              <Select
                value={createForm.role}
                onValueChange={next => {
                  if (next === 'EMPLOYEE' || next === 'ADMIN') {
                    setCreateForm(f => ({ ...f, role: next }))
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</SelectItem>
                  <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className="w-fit">
                {ROLE_LABELS.EMPLOYEE}
              </Badge>
            )}
          </div>
          <div className="col-span-2">
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      </section>

    </div>
  )
}
