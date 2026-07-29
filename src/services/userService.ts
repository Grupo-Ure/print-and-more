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

const AVATAR_BUCKET = 'avatars'
/** Path prefix public object URLs of the avatars bucket share. */
const AVATAR_PUBLIC_PREFIX = `/storage/v1/object/public/${AVATAR_BUCKET}/`

/**
 * Bucket path of an avatar we host, or null for external URLs (e.g. an
 * OAuth-provided avatar_url) — those are not ours to delete.
 */
function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null
  const index = url.indexOf(AVATAR_PUBLIC_PREFIX)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + AVATAR_PUBLIC_PREFIX.length))
}

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

  /** Renames the signed-in user (self-update RLS; the trigger pins all other columns). */
  async updateOwnName(name: string): Promise<UserRow> {
    const id = await this.requireOwnId()
    return this.updateOwnRow(id, { name })
  }

  /**
   * Uploads a (pre-resized) avatar image under a fresh random name in the
   * user's bucket folder, points the row at its public URL and then deletes
   * the previous object. Rotating the file name instead of overwriting keeps
   * the CDN cache from ever serving a stale image.
   */
  async updateOwnAvatar(image: Blob): Promise<UserRow> {
    const id = await this.requireOwnId()
    const previousUrl = (await this.getCurrentUser())?.avatar_url ?? null

    const path = `${id}/${crypto.randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, image, { contentType: 'image/jpeg' })
    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    let row: UserRow
    try {
      row = await this.updateOwnRow(id, { avatar_url: urlData.publicUrl })
    } catch (error) {
      // The row still points at the old avatar — drop the orphaned upload.
      void supabase.storage.from(AVATAR_BUCKET).remove([path])
      throw error
    }
    await this.deleteAvatarObject(previousUrl)
    return row
  }

  /** Clears the signed-in user's avatar and deletes the stored object. */
  async removeOwnAvatar(): Promise<UserRow> {
    const id = await this.requireOwnId()
    const previousUrl = (await this.getCurrentUser())?.avatar_url ?? null
    const row = await this.updateOwnRow(id, { avatar_url: null })
    await this.deleteAvatarObject(previousUrl)
    return row
  }

  private async requireOwnId(): Promise<string> {
    const user = await authService.getUser()
    if (!user) throw new Error('Not signed in')
    return user.id
  }

  private async updateOwnRow(
    id: string,
    patch: Partial<Pick<AppUserRow, 'name' | 'avatar_url'>>,
  ): Promise<UserRow> {
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select(USER_COLUMNS)
      .single()
    if (error) throw error
    return data
  }

  /** Best-effort: a leftover object costs nothing; the row update already stuck. */
  private async deleteAvatarObject(url: string | null): Promise<void> {
    const path = avatarPathFromUrl(url)
    if (!path) return
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
    if (error) console.warn('Failed to delete previous avatar object', error)
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
