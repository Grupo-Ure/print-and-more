import { useRef, useState } from 'react'
import { Camera, Check, Loader2, Pencil, X } from 'lucide-react'
import { Login } from '../components/Login'
import { UserAvatar } from '../components/UserAvatar'
import { useToast } from '../components/Toast'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import {
  useCurrentUser,
  useRemoveOwnAvatar,
  useUpdateOwnAvatar,
  useUpdateOwnName,
} from '../queries/userQueries'
import { ROLE_LABELS } from '../lib/roleLabels'
import type { UserRow } from '../services/userService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Label/value row of the account details card. */
function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-4 px-4 py-2.5">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-foreground">{value}</span>
    </div>
  )
}

/** Name row that flips into an inline input with save/cancel. */
function EditableNameRow({ user }: { user: UserRow }) {
  const { showError } = useToast()
  const updateName = useUpdateOwnName()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(user.name)

  const save = () => {
    const name = draft.trim()
    if (!name) return
    if (name === user.name) {
      setEditing(false)
      return
    }
    updateName.mutate(name, {
      onSuccess: () => setEditing(false),
      onError: error => showError(`Failed to update name: ${error.message}`),
    })
  }

  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-4 px-4 py-2.5">
      <span className="text-neutral-500">Name</span>
      {editing ? (
        <span className="flex min-w-0 items-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') save()
              if (event.key === 'Escape') setEditing(false)
            }}
            disabled={updateName.isPending}
            className="h-9 max-w-64"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Save name"
            onClick={save}
            disabled={updateName.isPending || !draft.trim()}
          >
            {updateName.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel"
            onClick={() => setEditing(false)}
            disabled={updateName.isPending}
          >
            <X />
          </Button>
        </span>
      ) : (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-foreground">{user.name}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit name"
            onClick={() => {
              setDraft(user.name)
              setEditing(true)
            }}
          >
            <Pencil />
          </Button>
        </span>
      )}
    </div>
  )
}

/**
 * Identity card: large avatar with a hover overlay to pick a new image,
 * name, email, role badge, and the change/remove picture actions.
 */
function IdentityCard({ user }: { user: UserRow }) {
  const { showError } = useToast()
  const updateAvatar = useUpdateOwnAvatar()
  const removeAvatar = useRemoveOwnAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const busy = updateAvatar.isPending || removeAvatar.isPending

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again still fires a change event.
    event.target.value = ''
    if (!file) return
    updateAvatar.mutate(file, {
      onError: error => showError(`Failed to update profile picture: ${error.message}`),
    })
  }

  return (
    <section className="flex flex-col items-center rounded-md border border-neutral-200 p-6 text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        aria-label="Change profile picture"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="group relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="size-24 text-4xl" />
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity ${
            busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </span>
      </button>
      <div className="mt-3 w-full truncate text-lg font-semibold text-foreground desktop:text-xl">
        {user.name}
      </div>
      <div className="w-full truncate text-sm text-neutral-500 desktop:text-base">{user.email}</div>
      <Badge variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'} className="mt-3">
        {ROLE_LABELS[user.role]}
      </Badge>
      <div className="mt-4 flex gap-3 text-sm">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {updateAvatar.isPending ? 'Uploading…' : 'Change picture'}
        </button>
        {user.avatar_url && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              removeAvatar.mutate(undefined, {
                onError: error => showError(`Failed to remove profile picture: ${error.message}`),
              })
            }
            className="cursor-pointer text-neutral-500 hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Remove picture
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * The signed-in user's account page. Name and profile picture are editable
 * (self-service); email and role are read-only — they are managed by admins.
 * Full-width like the stock pages: identity card beside the account details.
 */
export function ProfilePage() {
  const { session, loading: sessionLoading } = useSupabaseSession()
  const { data: user, isLoading: userLoading } = useCurrentUser()

  if (sessionLoading) return null
  if (!session) return <Login />
  if (userLoading || !user) return null

  return (
    <main className="flex w-full flex-col gap-3 p-3">
      <h1>Profile</h1>

      <div className="grid grid-cols-[20rem_minmax(0,1fr)] items-start gap-3 desktop:grid-cols-[24rem_minmax(0,1fr)]">
        <IdentityCard user={user} />

        <section className="rounded-md border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="font-semibold">Account details</h2>
            <p className="text-xs text-neutral-500 desktop:text-sm">
              Email and role are managed by an admin.
            </p>
          </div>

          {/* Same scale as the order page's body text (global `p` element scale). */}
          <div className="divide-y divide-neutral-100 py-1 text-base desktop:text-lg">
            <EditableNameRow user={user} />
            <ProfileRow label="Email" value={user.email} />
            <ProfileRow label="Role" value={ROLE_LABELS[user.role]} />
            <ProfileRow
              label="Member since"
              value={new Date(user.created_at).toLocaleDateString('en-GB')}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
