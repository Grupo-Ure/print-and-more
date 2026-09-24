import { supabase } from '../supabase'
import type { DefaultAssigneeStatus, Department, DepartmentDefaultAssigneeRow } from '../types/database'

export type DepartmentDefaultAssignee = Pick<DepartmentDefaultAssigneeRow, 'department' | 'status' | 'user_id'>

/**
 * Per-department settings. Today that is one thing: the default assignee per
 * stage (`department_default_assignees`, one row per department and stage).
 * The `fn_assign_stage_default_assignee` trigger reads it when a job enters
 * pre-press or production. Writes are admin-only by RLS.
 */
class DepartmentSettingsService {
  async getDefaultAssignees(): Promise<DepartmentDefaultAssignee[]> {
    const { data, error } = await supabase
      .from('department_default_assignees')
      .select('department, status, user_id')
    if (error) throw error
    return data ?? []
  }

  /** `null` removes the default: a job entering that stage keeps whoever holds it. */
  async setDefaultAssignee(
    department: Department,
    status: DefaultAssigneeStatus,
    userId: string | null,
  ): Promise<void> {
    if (userId === null) {
      const { error } = await supabase
        .from('department_default_assignees')
        .delete()
        .eq('department', department)
        .eq('status', status)
      if (error) throw error
      return
    }
    const { error } = await supabase
      .from('department_default_assignees')
      .upsert(
        { department, status, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: 'department,status' },
      )
    if (error) throw error
  }
}

export const departmentSettingsService = new DepartmentSettingsService()
