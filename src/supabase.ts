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
  // Google OAuth returns the session in the URL fragment, so it has to be read
  // on load. When this is packaged for Electron the callback arrives through a
  // custom protocol instead and this goes back to false.
  auth: { detectSessionInUrl: true },
})