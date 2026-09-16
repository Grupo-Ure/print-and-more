import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/supabase'

export type AdminClient = SupabaseClient<Database>

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. The e2e runner needs it to provision test data — ` +
        'for a local Supabase, copy it from `supabase status`.',
    )
  }
  return value
}

/**
 * Service-role client for the test runner: bypasses RLS and exposes
 * `auth.admin`. Used only from global setup/teardown and fixtures to create
 * and remove test data — never from inside the app under test.
 */
export function createAdminClient(): AdminClient {
  return createClient<Database>(
    requiredEnv('VITE_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
