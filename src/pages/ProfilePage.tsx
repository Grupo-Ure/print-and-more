import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Camera, Check, Loader2, Pencil, X } from 'lucide-react'
import { authService } from '../services/authService'
import { Login } from '../components/Login'
import { UserAvatar } from '../components/UserAvatar'
import { useToast } from '../components/Toast'
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
import { Separator } from '@/components/ui/separator'

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{value}</span>
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

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <span className="text-neutral-500">Name</span>
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
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-neutral-500">Name</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
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
    </div>
  )
}

/** Avatar with a hover overlay to pick a new image, plus change/remove links. */
function AvatarEditor({ user }: { user: UserRow }) {
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
    <div className="flex items-center gap-4">
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
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} className="size-16 text-2xl" />
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity ${
            busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold text-foreground desktop:text-xl">
          {user.name}
        </div>
        <div className="truncate text-sm text-neutral-500 desktop:text-base">{user.email}</div>
        <div className="mt-1 flex gap-3 text-sm">
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
                  onError: error =>
                    showError(`Failed to remove profile picture: ${error.message}`),
                })
              }
              className="cursor-pointer text-neutral-500 hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Remove picture
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The signed-in user's account page. Name and profile picture are editable
 * (self-service); email and role are read-only — they are managed by admins.
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1>Profile</h1>

      <section className="rounded-md border border-neutral-200">
        <div className="flex items-center gap-4 p-4">
          <AvatarEditor user={user} />
          <Badge
            variant={user.role === 'EMPLOYEE' ? 'secondary' : 'default'}
            className="ml-auto shrink-0"
          >
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <Separator />

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
  )
}
