import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { authService } from '../services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Brand mark — the fixed Google colours are required by their branding rules,
// so this is a deliberate exception to the CSS-variable colour system.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.17-2 3.44-4.95 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.28 15.1.25 12 .25 7.52.25 3.65 2.82 1.7 6.85l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z"
      />
    </svg>
  )
}

export function Login() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

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

  // Desktop only: the system browser sends the PKCE code back through
  // pam://auth/callback, which main forwards here.
  useEffect(() => {
    const bridge = window.pam
    if (!bridge) return

    return bridge.deepLinks.onAuthCallback(result => {
      if (!result.ok) {
        setLoginError(result.error)
        setRedirecting(false)
        return
      }
      void (async () => {
        try {
          await authService.completeOAuthSignIn(result.code)
          void queryClient.invalidateQueries()
        } catch (err) {
          const raw = err instanceof Error ? err.message : ''
          setLoginError(raw || 'Google sign-in failed. Please try again.')
          setRedirecting(false)
        }
      })()
    })
  }, [queryClient])

  async function handleGoogleLogin() {
    setLoginError('')
    setRedirecting(true)
    try {
      // On success the window navigates to Google, so the flag is only ever
      // cleared on failure.
      await authService.signInWithGoogle()
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      setLoginError(raw || 'Google sign-in failed. Please try again.')
      setRedirecting(false)
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

          <Button type="submit" size="lg" disabled={submitting || redirecting} className="mt-1">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          {/* type="button" — inside the form for layout, but must not submit it. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={submitting || redirecting}
            onClick={handleGoogleLogin}
          >
            <GoogleIcon className="size-4" />
            {redirecting ? 'Redirecting…' : 'Sign in with Google'}
          </Button>
        </form>
      </div>
    </div>
  )
}
