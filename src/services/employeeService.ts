import { supabase } from '../supabase'

export type EmployeeRow = {
  id: string
  email: string | null
}

export type ProfileRow = {
  id: string
  name: string
}

class EmployeeService {
  async getEmployees(): Promise<EmployeeRow[]> {
    const { data, error } = await supabase
      .from('mitarbeiter')
      .select('id, email')
    if (error) throw error
    return (data ?? []) as EmployeeRow[]
  }

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profile')
      .select('id, name')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as ProfileRow | null
  }

  async getAllProfiles(): Promise<ProfileRow[]> {
    const { data, error } = await supabase.from('profile').select('id, name')
    if (error) throw error
    return (data ?? []) as ProfileRow[]
  }
}

export const employeeService = new EmployeeService()
