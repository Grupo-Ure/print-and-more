import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Supabase-Konfiguration fehlt: VITE_SUPABASE_URL und ' +
      'VITE_SUPABASE_ANON_KEY müssen in der .env gesetzt sein.'
  )
}

export const supabase = createClient<Database>(url, key)