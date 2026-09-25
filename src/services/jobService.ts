import { supabase } from '../supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'
import type { DeliveryChoice, JobRow, JobStatus, Department, OrderStatus, Priority } from '../types/database'
import { resolveEffectiveJob } from '../lib/jobShared'

/** SELECT for `jobs` — the full row as the app consumes it (`JobRow`). */
const JOB_COLUMNS =
  'id, job_number, order_id, department, type, status, deadline, delivery, priority, assignee_id, is_cancelled, customer_approval_required, customer_approval_granted, customer_approval_file_id' as const

export type JobInsert = Omit<Database['public']['Tables']['jobs']['Insert'], 'job_number'>
type JobUpdate = Database['public']['Tables']['jobs']['Update']

/** Pause before replacing a realtime channel that was lost. */
const RESUBSCRIBE_DELAY_MS = 2000

/** The statuses the production feed lists: work that waits for, or is with, its assignee. */
export const PRODUCTION_FEED_STATUSES: readonly JobStatus[] = ['PREPRESS', 'IN_PRODUCTION']

/**
 * One row of the production feed: the job with the order fields its inherited
 * values resolve against, the customer's name, and a nested product count.
 */
export type ProductionJob = Pick<
  JobRow,
  | 'id'
  | 'job_number'
  | 'order_id'
  | 'department'
  | 'status'
  | 'deadline'
  | 'delivery'
  | 'priority'
  | 'assignee_id'
  | 'is_cancelled'
  | 'customer_approval_required'
  | 'customer_approval_granted'
> & {
  orders: {
    order_number: string
    status: OrderStatus
    deadline: string | null
    delivery: DeliveryChoice | null
    priority: Priority
    customers: { name: string } | null
  }
  department_products: { count: number }[]
}

const PRODUCTION_JOB_SELECT =
  'id, job_number, order_id, department, status, deadline, delivery, priority, assignee_id, is_cancelled, customer_approval_required, customer_approval_granted, orders!inner(order_number, status, deadline, delivery, priority, is_archived, customers(name)), department_products(count)'

/**
 * Feed order: effective priority HIGH before NORMAL regardless of date, then
 * effective deadline ascending with undated jobs last, then job number for a
 * stable list.
 */
function compareProductionJobs(left: ProductionJob, right: ProductionJob): number {
  const leftEffective = resolveEffectiveJob(left, left.orders)
  const rightEffective = resolveEffectiveJob(right, right.orders)
  if (leftEffective.priority !== rightEffective.priority) {
    return leftEffective.priority === 'HIGH' ? -1 : 1
  }
  const leftDeadline = leftEffective.deadline ?? '9999-12-31'
  const rightDeadline = rightEffective.deadline ?? '9999-12-31'
  if (leftDeadline !== rightDeadline) return leftDeadline < rightDeadline ? -1 : 1
  return left.job_number.localeCompare(right.job_number)
}

/** Supabase may emit a to-one join as a one-element array; keep the published shape a single row. */
function flattenOrderCustomer(job: ProductionJob): ProductionJob {
  const customers: unknown = job.orders.customers
  if (Array.isArray(customers)) {
    return { ...job, orders: { ...job.orders, customers: customers[0] ?? null } }
  }
  return job
}

export type JobSummary = {
  id: string
  department: Department
}

export type ActiveJobSlim = {
  id: string
  status: JobStatus
  department: Department
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
      .insert(payload as Database['public']['Tables']['jobs']['Insert'])
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

  async setJobStatus(id: string, status: JobStatus): Promise<JobRow> {
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

  /**
   * Every job the Production page lists: in pre-press or production, not
   * cancelled, on a non-archived order — across all orders, sorted for the feed.
   */
  async listProductionJobs(): Promise<ProductionJob[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select(PRODUCTION_JOB_SELECT)
      .in('status', [...PRODUCTION_FEED_STATUSES])
      .eq('is_cancelled', false)
      .eq('orders.is_archived', false)
    if (error) throw error
    // Cast: the nested `orders` / `customers` joins come back untyped from the select string.
    const rows = (data ?? []) as unknown as ProductionJob[]
    return rows.map(flattenOrderCustomer).sort(compareProductionJobs)
  }

  async getActiveJobsByBereich(department: Department): Promise<ActiveJobSlim[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, status, department, is_cancelled')
      .eq('department', department)
    if (error) throw error
    return (data ?? []) as unknown as ActiveJobSlim[]
  }

  /**
   * Realtime subscription: fires `onChanged` on any INSERT/UPDATE/DELETE of
   * `jobs` or `orders` (the order carries the inherited deadline, priority,
   * delivery and the archive flag), so the production feed can refetch.
   *
   * Self-healing: a channel that errors, times out or closes without being
   * asked to (dropped network, laptop sleep, a hot reload in development) is
   * replaced after a short pause, and `onChanged` fires once the replacement
   * is subscribed so changes missed in the gap are picked up.
   * Returns an unsubscribe function.
   */
  subscribeToJobChanges(onChanged: () => void): () => void {
    let channel: RealtimeChannel | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnecting = false

    const open = () => {
      // A unique topic per channel: supabase.channel() hands back an existing
      // channel of the same name, so a remount (StrictMode, page switch) would
      // reuse the one still being removed and die with it.
      const current: RealtimeChannel = supabase
        .channel(`production-feed-refresh:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => onChanged())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChanged())
        .subscribe(status => {
          // Ignore channels already replaced or unsubscribed on purpose.
          if (stopped || current !== channel) return
          if (status === 'SUBSCRIBED') {
            if (reconnecting) onChanged()
            reconnecting = false
            return
          }
          // CHANNEL_ERROR, TIMED_OUT, or CLOSED that we did not ask for.
          channel = null
          reconnecting = true
          void supabase.removeChannel(current)
          retryTimer = setTimeout(open, RESUBSCRIBE_DELAY_MS)
        })
      channel = current
    }

    open()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }
}

export const jobService = new JobService()
