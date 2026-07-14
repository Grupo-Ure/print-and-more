import { supabase } from '../supabase'
import type { Database } from '../types/supabase'
import { JOB_COLUMNS } from '../const/jobSelect'
import type { JobRow, OrderStatus, Department } from '../types/database'

type JobInsert = Database['public']['Tables']['jobs']['Insert']
type JobUpdate = Database['public']['Tables']['jobs']['Update']

export type JobSummary = {
  id: string
  department: Department
}

export type ActiveJobSlim = {
  id: string
  status: OrderStatus
  department: Department
  detail: Database['public']['Tables']['jobs']['Row']['detail']
  is_cancelled: boolean
}

class JobService {
  async getJobsByOrderId(orderId: string): Promise<JobRow[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select(JOB_COLUMNS)
      .eq('order_id', orderId)
      .order('id', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as JobRow[]
  }

  async getJobById(id: string): Promise<JobRow | null> {
    const { data, error } = await supabase
      .from('jobs')
      .select(JOB_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as JobRow | null
  }

  async createJob(payload: JobInsert): Promise<JobRow> {
    const { data, error } = await supabase
      .from('jobs')
      .insert(payload)
      .select(JOB_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as JobRow
  }

  async updateJob(id: string, patch: JobUpdate): Promise<JobRow> {
    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', id)
      .select(JOB_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as JobRow
  }

  async setJobStatus(id: string, status: OrderStatus): Promise<JobRow> {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select(JOB_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as JobRow
  }

  async setCustomerApproval(
    id: string,
    patch: Pick<
      JobUpdate,
      'customer_approval_required' | 'customer_approval_granted' | 'customer_approval_file_id'
    >,
  ): Promise<JobRow> {
    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', id)
      .select(JOB_COLUMNS)
      .single()
    if (error) throw error
    return data as unknown as JobRow
  }

  async cancelJob(id: string): Promise<void> {
    const { error } = await supabase
      .from('jobs')
      .update({ is_cancelled: true })
      .eq('id', id)
    if (error) throw error
  }

  async cancelAllJobsForOrder(orderId: string): Promise<void> {
    const { error } = await supabase
      .from('jobs')
      .update({ is_cancelled: true })
      .eq('order_id', orderId)
    if (error) throw error
  }

  async deleteJob(id: string): Promise<void> {
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) throw error
  }

  async getJobSummariesForOrder(orderId: string): Promise<JobSummary[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, department')
      .eq('order_id', orderId)
    if (error) throw error
    return (data ?? []) as unknown as JobSummary[]
  }

  async getActiveJobsByBereich(department: Department): Promise<ActiveJobSlim[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, status, department, detail, is_cancelled')
      .eq('department', department)
    if (error) throw error
    return (data ?? []) as unknown as ActiveJobSlim[]
  }
}

export const jobService = new JobService()
