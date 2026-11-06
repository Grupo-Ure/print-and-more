import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { backupJobKeys } from '../queries/backupJobQueries'
import { backupJobService, type BackupJob } from '../services/backupJobService'
import { backupSettingsService } from '../services/backupSettingsService'
import { useSupabaseSession } from './useSupabaseSession'

/**
 * This copy of the app's part in bringing backups to the shop folder
 * (BACKUP_RUNTIME.md, WP3). Mounted once in App; active only with a session
 * and the desktop bridge. On the roll call, on mount and when the channel is
 * back after a loss, it goes through the claimable jobs oldest first: probe
 * the folder, claim, deliver, report. The database referees between copies,
 * so a job another copy claimed first is simply skipped.
 *
 * One pass at a time; a nudge during a pass runs one more pass after it. A
 * failed delivery is reported — the job is free again for every copy — and
 * ends the pass until the next nudge. Silent throughout: delivery is
 * background work, and Settings → Backups shows what happened.
 */
export function useBackupDelivery(): void {
  const { session } = useSupabaseSession()
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null

  useEffect(() => {
    const bridge = window.pam?.backups
    if (userId === null || !bridge) return

    let stopped = false
    let running = false
    let again = false

    const deliverJob = async (job: BackupJob, sessionId: string, machine: string): Promise<boolean> => {
      const settings = await backupSettingsService.get()
      const share = { server: settings.share_server, share: settings.share_name, folder: settings.share_folder }

      const folder = await bridge.probeFolder(share, job.size_bytes)
      if (!folder.reachable) return false

      const claimed = await backupJobService.claim(job.id, sessionId, machine)
      if (claimed === null) return true

      let failure: string
      try {
        const url = await backupJobService.signedUrl(claimed)
        const result = await bridge.deliver({
          share,
          url,
          fileName: claimed.storage_path,
          sha256: claimed.sha256,
          sizeBytes: claimed.size_bytes,
        })
        if (result.ok) {
          await backupJobService.reportDelivered(claimed.id, sessionId, result.sha256)
          return true
        }
        failure = result.error
      } catch (error) {
        failure = error instanceof Error ? error.message : 'The delivery failed.'
      }
      await backupJobService.reportFailed(claimed.id, sessionId, failure)
      return false
    }

    const pass = async () => {
      if (running) {
        again = true
        return
      }
      running = true
      try {
        do {
          again = false
          const { sessionId, machine } = await bridge.identity()
          for (const job of await backupJobService.listClaimable()) {
            if (stopped) return
            const carryOn = await deliverJob(job, sessionId, machine)
            void queryClient.invalidateQueries({ queryKey: backupJobKeys.all })
            if (!carryOn) break
          }
        } while (again && !stopped)
      } catch {
        // A pass that cannot reach the database waits for the next nudge.
      } finally {
        running = false
      }
    }

    const unsubscribe = backupJobService.subscribeToRollCall(() => void pass())
    void pass()

    return () => {
      stopped = true
      unsubscribe()
    }
  }, [userId, queryClient])
}
