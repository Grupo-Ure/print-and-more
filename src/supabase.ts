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
  // Desktop app: no OAuth redirects, so never scan the URL for session tokens.
  auth: { detectSessionInUrl: false },
})