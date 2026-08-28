import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { authService } from '../services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Login() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setSubmitting(true)
    try {
      await authService.signIn(email.trim(), password)
      // Sign-out clears the query cache while pages stay mounted, so active
      // queries refetch and cache logged-out nulls (kept by staleTime). Force
      // everything to refetch under the new session.
      void queryClient.invalidateQueries()
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      const isUseless = !raw || raw === '{}' || raw === '[]'
      setLoginError(isUseless ? 'Login failed. Please check your credentials and try again.' : raw)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-neutral-50 p-6 font-sans">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm font-normal text-muted-foreground">
            Sign in to your workspace to continue
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="flex flex-col gap-4 rounded-md border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-invalid={loginError ? true : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-invalid={loginError ? true : undefined}
            />
          </div>

          {loginError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {loginError}
            </div>
          )}

          <Button type="submit" size="lg" disabled={submitting} className="mt-1">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
