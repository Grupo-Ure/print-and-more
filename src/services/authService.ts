import { supabase } from '../supabase'
import type { Session, User, AuthChangeEvent, Subscription } from '@supabase/supabase-js'

class AuthService {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  }

  async getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser()
    return data.user
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!data.session) throw new Error('Sign-in succeeded but no session was returned')
    return data.session
  }

  /**
   * Desktop: Google refuses OAuth inside embedded app windows, so the sign-in
   * page opens in the system browser and returns through pam://auth/callback.
   * Browser: the ordinary redirect, completed by detectSessionInUrl.
   */
  async signInWithGoogle(): Promise<void> {
    const bridge = window.pam
    if (!bridge) {
      // Explicit, because the project's Site URL is the desktop deep link —
      // falling back to it would send a browser session into pam://.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
      return
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { skipBrowserRedirect: true, redirectTo: 'pam://auth/callback' },
    })
    if (error) throw error
    if (!data.url) throw new Error('Sign-in could not be started.')

    const opened = await bridge.openExternal(data.url)
    if (!opened.ok) throw new Error(opened.error)
  }

  /** Completes the desktop flow: the PKCE code from the deep link → a session. */
  async completeOAuthSignIn(code: string): Promise<Session> {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    if (!data.session) throw new Error('Sign-in completed but no session was returned')
    return data.session
  }

  /**
   * Sets a new password and clears the first-login flag in the same call, so a
   * forced change can never be dismissed without actually changing anything.
   */
  async changePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    if (error) throw error
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { subscription: Subscription } {
    const { data } = supabase.auth.onAuthStateChange(callback)
    return data
  }
}

export const authService = new AuthService()
