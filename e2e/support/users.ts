import type { AdminClient } from './admin'
import type { TestUser } from '../fixtures/users'

async function findUserId(admin: AdminClient, email: string): Promise<string | null> {
  const { data, error } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/**
 * Creates the login unless a previous (crashed) run left it behind. The role
 * goes in via app_metadata: the on_auth_user_created trigger reads it from
 * there, so the public.users row is born with the right role and no update —
 * which the role-guard trigger would refuse — is needed.
 */
export async function ensureTestUser(admin: AdminClient, user: TestUser): Promise<void> {
  if (await findUserId(admin, user.email)) return
  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { name: user.name },
    app_metadata: { role: user.role },
  })
  if (error) throw error
}

/** Deletes the auth user; public.users follows by cascade. */
export async function removeTestUser(admin: AdminClient, user: TestUser): Promise<void> {
  const id = await findUserId(admin, user.email)
  if (!id) return
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw error
}
