import { useEffect, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { authService } from '../services/authService'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { useToast } from './Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MIN_LENGTH = 8

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** First sign-in after an admin created the account: no way out but to set one. */
  required?: boolean
}

export function ChangePasswordDialog({ open, onOpenChange, required = false }: Props) {
  const { showSuccess } = useToast()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Never leave a typed password sitting in state behind a closed dialog.
  useEffect(() => {
    if (open) return
    setPassword('')
    setConfirmation('')
    setError('')
    setSaving(false)
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirmation) {
      setError('The two entries do not match.')
      return
    }

    setError('')
    setSaving(true)
    try {
      await authService.changePassword(password)
      showSuccess('Password updated')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.')
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!required}
        onInteractOutside={required ? event => event.preventDefault() : undefined}
        onEscapeKeyDown={required ? event => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{required ? 'Choose your password' : 'Change password'}</DialogTitle>
          <DialogDescription>
            {required
              ? 'Your account was created with a temporary password. Set your own to continue.'
              : `Pick something at least ${MIN_LENGTH} characters long.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Repeat new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            {!required && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Mounted app-wide: an account an admin created with a temporary password
 * carries `must_change_password` until its owner picks their own. Clearing the
 * flag is part of the same updateUser call, so the session refresh that
 * follows is what dismisses this.
 */
export function ForcedPasswordChange() {
  const { session } = useSupabaseSession()
  const mustChange = session?.user.user_metadata?.must_change_password === true

  return <ChangePasswordDialog open={mustChange} onOpenChange={() => {}} required />
}
