import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Supabase configuration missing: VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY must be set in .env.'
  )
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    // PKCE: the OAuth callback carries a single-use code rather than a session,
    // so no token ever travels through a URL the OS can log. On the desktop the
    // code arrives via pam://auth/callback and is exchanged explicitly.
    flowType: 'pkce',
    // Only the browser build can receive a callback in its own address bar; the
    // Electron renderer is served from app://bundle and never navigates away.
    detectSessionInUrl: window.pam == null,
  },
})