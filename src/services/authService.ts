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

  // Navigates the window to Google; nothing is returned here. The session
  // arrives in the URL on the way back and is picked up by the client
  // (detectSessionInUrl) which then fires onAuthStateChange.
  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
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
