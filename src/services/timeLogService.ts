import { supabase } from '../supabase'
import { authService } from './authService'
import { historyService } from './historyService'

/**
 * Worked-time entries per job (`job_time_logs`). The job's total time is
 * always the sum over its logs — there is no aggregate column on `jobs`.
 * `user` is whom the time is attributed to; `created_by` is who wrote the
 * row (they differ when an admin logs on someone's behalf — enforced by RLS).
 */
export type TimeLogRow = {
  id: string
  job_id: string
  minutes: number
  created_at: string
  user: { id: string; name: string; avatar_url: string | null } | null
  created_by: { id: string; name: string } | null
}

const TIME_LOG_COLUMNS =
  'id, job_id, minutes, created_at, ' +
  'user:users!job_time_logs_user_id_fkey(id, name, avatar_url), ' +
  'created_by:users!job_time_logs_created_by_fkey(id, name)'

class TimeLogService {
  async getByJobId(jobId: string): Promise<TimeLogRow[]> {
    const { data, error } = await supabase
      .from('job_time_logs')
      .select(TIME_LOG_COLUMNS)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as TimeLogRow[]
  }

  /**
   * Total logged minutes per job for an order (job id → minutes; jobs without
   * logs map to 0). Feeds the job-list and order-header time displays without
   * loading full log rows per job.
   */
  async getMinutesByOrderId(orderId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_time_logs(minutes)')
      .eq('order_id', orderId)
    if (error) throw error
    return Object.fromEntries(
      (data ?? []).map(row => [
        row.id,
        (row.job_time_logs ?? []).reduce((sum, log) => sum + log.minutes, 0),
      ]),
    )
  }

  /**
   * Insert a log attributed to `user` (the signed-in user unless an admin
   * logged on someone's behalf) and record the full event in history:
   * actor = history.user_id, attributed user + minutes in meta.
   */
  async create(params: {
    orderId: string
    jobId: string
    minutes: number
    user: { id: string; name: string }
  }): Promise<TimeLogRow> {
    const actor = await authService.getUser()
    const { data, error } = await supabase
      .from('job_time_logs')
      .insert({
        job_id: params.jobId,
        user_id: params.user.id,
        created_by: actor?.id ?? null,
        minutes: params.minutes,
      })
      .select(TIME_LOG_COLUMNS)
      .single()
    if (error) throw error
    await historyService.tryWriteHistory({
      order_id: params.orderId,
      job_id: params.jobId,
      event_type: 'TIME_LOGGED',
      meta: {
        minutes: params.minutes,
        user_id: params.user.id,
        user_name: params.user.name,
      },
    })
    return data as unknown as TimeLogRow
  }

  /** Admin-only (enforced by RLS). Records the removed log in history. */
  async remove(params: { orderId: string; log: TimeLogRow }): Promise<void> {
    const { log } = params
    const { error } = await supabase.from('job_time_logs').delete().eq('id', log.id)
    if (error) throw error
    await historyService.tryWriteHistory({
      order_id: params.orderId,
      job_id: log.job_id,
      event_type: 'TIME_LOG_DELETED',
      meta: {
        minutes: log.minutes,
        user_id: log.user?.id ?? null,
        user_name: log.user?.name ?? null,
        logged_at: log.created_at,
      },
    })
  }
}

export const timeLogService = new TimeLogService()
