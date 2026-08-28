import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Login } from '../components/Login'
import { AccessDenied } from '../components/AccessDenied'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import {
  useCreateUser,
  useCurrentUser,
  useDeleteUser,
  useUpdateUserRole,
  useUsers,
} from '../queries/userQueries'
import type { UserRow } from '../services/userService'
import { ROLE_LABELS } from '../lib/roleLabels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

type ManagedRole = 'EMPLOYEE' | 'ADMIN'

const CREATE_FORM_INITIAL = { email: '', password: '', name: '', role: 'EMPLOYEE' as ManagedRole }

/** Card header of the accounts table, with an optional right-aligned action. */
function CardHeader({
  title,
  note,
  action,
}: {
  title: string
  note: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-neutral-500 desktop:text-sm">{note}</p>
      </div>
      {action}
    </div>
  )
}

/** Create-account dialog; the page is super-admin gated, so the role is freely selectable. */
function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The content unmounts on close, so the form starts fresh each time. */}
        <CreateAccountForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function CreateAccountForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { showError, showSuccess } = useToast()
  const createUser = useCreateUser()
  const [form, setForm] = useState(CREATE_FORM_INITIAL)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    createUser.mutate(form, {
      onSuccess: user => {
        showSuccess(`Account for ${user.name} created`)
        onOpenChange(false)
      },
      onError: err => showError(err.message),
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create account</DialogTitle>
        <DialogDescription>
          The new user signs in with this email and initial password.
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-user-name">Name</Label>
          <Input
            id="new-user-name"
            autoFocus
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-user-email">Email</Label>
          <Input
            id="new-user-email"
            type="email"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-user-password">Initial password</Label>
          <Input
            id="new-user-password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Role</Label>
          <Select
            value={form.role}
            onValueChange={next => {
              if (next === 'EMPLOYEE' || next === 'ADMIN') setForm(f => ({ ...f, role: next }))
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
        </div>

        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? 'Creating…' : 'Create account'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function UserManagementPage() {
  const { showError, showSuccess } = useToast()
  const confirm = useConfirm()
  const { session, loading: sessionLoading } = useSupabaseSession()

  const { data: currentUser, isLoading: currentUserLoading } = useCurrentUser()
  const { data: users, isLoading: usersLoading } = useUsers()
  const updateRole = useUpdateUserRole()
  const deleteUser = useDeleteUser()

  const [createOpen, setCreateOpen] = useState(false)

  if (sessionLoading) return null
  if (!session) return <Login />
  if (currentUserLoading) return null

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  if (!isSuperAdmin) {
    return <AccessDenied description="User management requires a super admin account." />
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
    <main className="flex w-full flex-col gap-3 p-3">
      <h1>User management</h1>

      <section className="rounded-md border border-neutral-200">
        <CardHeader
          title="Accounts"
          note="Change roles or delete accounts. Super admin accounts and your own account can't be changed here."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              + Create account
            </Button>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading && (
              <TableRow>
                <TableCell colSpan={5} className="pl-4 text-neutral-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map(user => (
              <TableRow key={user.id}>
                <TableCell className="pl-4">
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
                <TableCell className="pr-4 text-right">
                  {canDelete(user) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Delete"
                      aria-label="Delete"
                      disabled={deleteUser.isPending}
                      onClick={() => void handleDelete(user)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  )
}
