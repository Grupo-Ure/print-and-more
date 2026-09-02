// manage-users — account lifecycle for admins/super admins.
//
// Exists only for what the browser cannot do: auth.admin.createUser /
// deleteUser need the service-role key. Role CHANGES do not go through here —
// they are plain updates on public.users, guarded by RLS + the
// enforce_user_role_rules trigger.
//
// Permission matrix (DB triggers backstop every rule):
//   ADMIN        create/delete EMPLOYEE accounts
//   SUPER_ADMIN  additionally create/delete ADMIN accounts
//   SUPER_ADMIN rows are untouchable through any app path; no self-delete.

import { createClient } from 'jsr:@supabase/supabase-js@2'

type UserRole = 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Missing Authorization header' })

    // Verify the caller's JWT explicitly (works identically under
    // `functions serve` and hosted, independent of platform verify_jwt).
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: callerAuth, error: callerAuthError } = await userClient.auth.getUser()
    if (callerAuthError || !callerAuth?.user) {
      return json(401, { error: 'Invalid or expired session' })
    }
    const callerId = callerAuth.user.id

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: callerRow, error: callerRowError } = await admin
      .from('users')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()
    if (callerRowError) {
      console.error('caller role lookup failed', callerRowError)
      return json(500, { error: 'Failed to resolve caller role' })
    }
    const callerRole = callerRow?.role as UserRole | undefined
    if (!callerRole || callerRole === 'EMPLOYEE') {
      return json(403, { error: 'Insufficient permissions' })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json(400, { error: 'Invalid JSON body' })
    }

    if (body.action === 'create') {
      const { email, password, name, role } = body
      if (
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password ||
        typeof name !== 'string' || !name.trim()
      ) {
        return json(400, { error: 'email, password and name are required' })
      }
      if (role !== 'EMPLOYEE' && role !== 'ADMIN') {
        return json(400, { error: "role must be 'EMPLOYEE' or 'ADMIN'" })
      }
      if (role === 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
        return json(403, { error: 'Admins can only create employee accounts' })
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        // The password is admin-chosen, so the owner is prompted to replace it
        // on first sign-in; changePassword() clears the flag.
        user_metadata: { name: name.trim(), must_change_password: true },
        // handle_new_user reads the initial role from app_metadata only.
        app_metadata: { role },
      })
      if (createError) {
        const status = createError.message?.toLowerCase().includes('already') ? 409 : 400
        return json(status, { error: createError.message })
      }

      const { data: newRow } = await admin
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('id', created.user.id)
        .single()
      return json(200, { user: newRow })
    }

    if (body.action === 'delete') {
      const { userId } = body
      if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return json(400, { error: 'userId must be a UUID' })
      }
      if (userId === callerId) {
        return json(400, { error: 'You cannot delete your own account' })
      }

      const { data: target, error: targetError } = await admin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (targetError) {
        console.error('target lookup failed', targetError)
        return json(500, { error: 'Failed to resolve target user' })
      }
      if (!target) return json(404, { error: 'User not found' })
      if (target.role === 'SUPER_ADMIN') {
        return json(403, { error: 'Super admin accounts cannot be deleted' })
      }
      if (target.role === 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
        return json(403, { error: 'Only super admins can delete admin accounts' })
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) {
        console.error('deleteUser failed', deleteError)
        return json(500, { error: deleteError.message })
      }
      return json(200, { success: true })
    }

    return json(400, { error: 'Unknown action' })
  } catch (err) {
    console.error('manage-users unhandled error', err)
    return json(500, { error: 'Internal error' })
  }
})
