import { supabase } from '../supabase'
import { authService } from './authService'
import type { Database, Json } from '../types/supabase'

export type HistoryEvent = Database['public']['Enums']['history_event']

type HistoryInsert = Database['public']['Tables']['history']['Insert']

export type HistoryRow = {
  id: string
  event_type: HistoryEvent
  reason: string | null
  meta: Json | null
  created_at: string
  job_id: string | null
  user_id: string | null
}

class HistoryService {
  async writeHistory(params: {
    order_id: string
    job_id?: string
    event_type: HistoryEvent
    reason?: string
    meta?: Record<string, unknown>
  }): Promise<void> {
    const user = await authService.getUser()

    const row: HistoryInsert = {
      order_id: params.order_id,
      job_id: params.job_id ?? null,
      event_type: params.event_type,
      reason: params.reason ?? null,
      meta: params.meta !== undefined ? (params.meta as Json) : null,
      user_id: user?.id ?? null,
    }

    const { error } = await supabase.from('history').insert(row)
    if (error) throw error
  }

  /**
   * Best-effort variant: history is a log, not a transaction participant — a
   * failed insert must never fail the action it records. All mutation call
   * sites use this; `writeHistory` stays for callers that want the error.
   */
  async tryWriteHistory(params: Parameters<HistoryService['writeHistory']>[0]): Promise<void> {
    try {
      await this.writeHistory(params)
    } catch (err) {
      console.error(`History ${params.event_type} failed`, err)
    }
  }

  async getHistoryForOrder(orderId: string): Promise<HistoryRow[]> {
    const { data, error } = await supabase
      .from('history')
      .select('id, event_type, reason, meta, created_at, job_id, user_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as HistoryRow[]
  }
}

export const historyService = new HistoryService()
