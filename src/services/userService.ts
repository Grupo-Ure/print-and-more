import { supabase } from '../supabase'
import { authService } from './authService'
import type { AppUserRow, UserRole } from '../types/database'

export type UserRow = Pick<AppUserRow, 'id' | 'name' | 'email' | 'role' | 'avatar_url' | 'created_at'>

export type CreateUserInput = {
  email: string
  password: string
  name: string
  role: Extract<UserRole, 'EMPLOYEE' | 'ADMIN'>
}

const USER_COLUMNS = 'id, name, email, role, avatar_url, created_at'

/**
 * Invokes the manage-users Edge Function. On non-2xx, supabase-js puts the
 * Response on error.context — surface the function's `{ error }` message.
 */
async function invokeManageUsers(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body })
  if (error) {
    let message = error instanceof Error ? error.message : String(error)
    const context = (error as { context?: Response }).context
    if (context && typeof context.clone === 'function') {
      try {
        const parsed = await context.clone().json()
        if (parsed && typeof parsed.error === 'string') message = parsed.error
      } catch {
        // keep the generic message
      }
    }
    throw new Error(message)
  }
  return data as Record<string, unknown>
}

class UserService {
  async getUsers(): Promise<UserRow[]> {
    const { data, error } = await supabase.from('users').select(USER_COLUMNS).order('name')
    if (error) throw error
    return data ?? []
  }

  async getCurrentUser(): Promise<UserRow | null> {
    const user = await authService.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  /** Role changes go straight to the table; RLS + the DB trigger enforce the rules. */
  async updateUserRole(id: string, role: Extract<UserRole, 'EMPLOYEE' | 'ADMIN'>): Promise<void> {
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) throw error
  }

  /** Account creation needs the service-role key → manage-users Edge Function. */
  async createUser(input: CreateUserInput): Promise<UserRow> {
    const data = await invokeManageUsers({ action: 'create', ...input })
    return data.user as UserRow
  }

  async deleteUser(userId: string): Promise<void> {
    await invokeManageUsers({ action: 'delete', userId })
  }
}

export const userService = new UserService()
