import { supabase } from '../supabase'
import type { Tables } from '../types/supabase'

/** One backup and its hand-over to the shop folder: a row of `backup_jobs`. */
export type BackupJob = Tables<'backup_jobs'>

/** Where the dumps wait until a running copy of the app has brought them to the shop. */
const BACKUPS_BUCKET = 'backups'

/** How long a job's download link holds: long enough to start the download, which then streams on. */
const SIGNED_URL_SECONDS = 600

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
}

export const backupJobService = new BackupJobService()
