import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Tables } from '../types/supabase'

/** One backup and its hand-over to the shop folder: a row of `backup_jobs`. */
export type BackupJob = Tables<'backup_jobs'>

/** Where the dumps wait until a running copy of the app has brought them to the shop. */
const BACKUPS_BUCKET = 'backups'

/** How long a job's download link holds: long enough to start the download, which then streams on. */
const SIGNED_URL_SECONDS = 600

/** The private channel the database calls the roll on (`fn_backup_job_roll_call`); its read policy names this topic. */
const ROLL_CALL_TOPIC = 'backups'

/** Pause before replacing a roll-call channel that was lost. */
const RESUBSCRIBE_DELAY_MS = 2000

/**
 * The backup record (`backup_jobs`). Read by every signed-in user; written
 * only through the database functions — a claim is one atomic update, so the
 * first copy of the app to claim a job gets it and every other gets `null`.
 * A copy identifies itself by a session id for the life of its process and
 * by its machine name.
 */
class BackupJobService {
  /** Every backup ever made, newest first. */
  async list(): Promise<BackupJob[]> {
    const { data, error } = await supabase.from('backup_jobs').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  }

  /** The jobs a copy may try to claim, oldest first: waiting ones, and taken ones whose lease has run out. */
  async listClaimable(): Promise<BackupJob[]> {
    const { data, error } = await supabase
      .from('backup_jobs')
      .select('*')
      .or(`state.eq.WAITING,and(state.eq.TAKEN,lease_until.lt.${new Date().toISOString()})`)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  }

  /** Claims the job for this copy; `null` when another copy holds it or it is delivered. */
  async claim(jobId: string, sessionId: string, machine: string): Promise<BackupJob | null> {
    const { data, error } = await supabase.rpc('claim_backup_job', {
      job_id: jobId,
      session_id: sessionId,
      machine,
    })
    if (error) throw error
    return data[0] ?? null
  }

  /** Records the delivery; refused unless this session holds the job and the fingerprint matches. */
  async reportDelivered(jobId: string, sessionId: string, sha256: string): Promise<BackupJob> {
    const { data, error } = await supabase.rpc('report_backup_delivered', {
      job_id: jobId,
      session_id: sessionId,
      sha256,
    })
    if (error) throw error
    return data
  }

  /** Gives the job back after a failed delivery, with the reason; another copy may then try. */
  async reportFailed(jobId: string, sessionId: string, reason: string): Promise<BackupJob> {
    const { data, error } = await supabase.rpc('report_backup_failed', {
      job_id: jobId,
      session_id: sessionId,
      reason,
    })
    if (error) throw error
    return data
  }

  /** A short-lived download link for the job's encrypted file, for the main process to stream from. */
  async signedUrl(job: BackupJob): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BACKUPS_BUCKET)
      .createSignedUrl(job.storage_path, SIGNED_URL_SECONDS)
    if (error) throw error
    return data.signedUrl
  }

  /**
   * Fires `onChanged` on any change to `backup_jobs` — a job recorded,
   * claimed, delivered, given back or purged — so Settings → Backups can
   * refetch, and once more when a lost channel is back. Self-healing as the
   * production feed's subscription is. Returns an unsubscribe function.
   */
  subscribeToJobChanges(onChanged: () => void): () => void {
    let channel: RealtimeChannel | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnecting = false

    const open = () => {
      // A unique topic per channel, so a remount never reuses one still being removed.
      const current: RealtimeChannel = supabase
        .channel(`backup-jobs-refresh:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'backup_jobs' }, () => onChanged())
        .subscribe(status => {
          if (stopped || current !== channel) return
          if (status === 'SUBSCRIBED') {
            if (reconnecting) onChanged()
            reconnecting = false
            return
          }
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

  /**
   * Listens for the roll call: `onRollCall` fires on every broadcast on the
   * private `backups` channel, and once more when a lost channel is back, so
   * a roll call missed in the gap is made up for.
   *
   * The topic is fixed — the channel's read policy names it — so a channel of
   * that topic still open from a remount is removed before a new one opens.
   * Self-healing as the production feed's subscription is. Returns an
   * unsubscribe function.
   */
  subscribeToRollCall(onRollCall: () => void): () => void {
    let channel: RealtimeChannel | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let reconnecting = false

    const open = async () => {
      const stale = supabase.getChannels().filter(existing => existing.topic === `realtime:${ROLL_CALL_TOPIC}`)
      await Promise.all(stale.map(old => supabase.removeChannel(old)))
      if (stopped) return

      const current: RealtimeChannel = supabase
        .channel(ROLL_CALL_TOPIC, { config: { private: true } })
        .on('broadcast', { event: 'roll-call' }, () => onRollCall())
        .subscribe(status => {
          if (stopped || current !== channel) return
          if (status === 'SUBSCRIBED') {
            if (reconnecting) onRollCall()
            reconnecting = false
            return
          }
          channel = null
          reconnecting = true
          void supabase.removeChannel(current)
          retryTimer = setTimeout(() => void open(), RESUBSCRIBE_DELAY_MS)
        })
      channel = current
    }

    void open()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      if (channel) void supabase.removeChannel(channel)
    }
  }
}

export const backupJobService = new BackupJobService()
