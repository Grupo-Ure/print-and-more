import { supabase } from '../supabase'
import type { Department, DepartmentDefaultAssigneeRow } from '../types/database'

export type DepartmentDefaultAssignee = Pick<DepartmentDefaultAssigneeRow, 'department' | 'user_id'>

/**
 * Per-department settings. Today that is one thing: the default assignee a
 * new job of that department gets (`department_default_assignees`, read by
 * the `fn_default_job_assignee` trigger). Writes are admin-only by RLS.
 */
class DepartmentSettingsService {
  async getDefaultAssignees(): Promise<DepartmentDefaultAssignee[]> {
    const { data, error } = await supabase
      .from('department_default_assignees')
      .select('department, user_id')
    if (error) throw error
    return data ?? []
  }

  /** `null` removes the default: new jobs of that department go to their creator again. */
  async setDefaultAssignee(department: Department, userId: string | null): Promise<void> {
    if (userId === null) {
      const { error } = await supabase
        .from('department_default_assignees')
        .delete()
        .eq('department', department)
      if (error) throw error
      return
    }
    const { error } = await supabase
      .from('department_default_assignees')
      .upsert({ department, user_id: userId, updated_at: new Date().toISOString() })
    if (error) throw error
  }
}

export const departmentSettingsService = new DepartmentSettingsService()
