import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { backupJobKeys } from '../queries/backupJobQueries'
import { backupJobService, type BackupJob } from '../services/backupJobService'
import { backupSettingsService } from '../services/backupSettingsService'
import { useSupabaseSession } from './useSupabaseSession'

/**
 * This copy of the app's part in bringing backups to the shop folder
 * (BACKUP_RUNTIME.md, WP3) and in deleting them from it once their keep has
 * run out (WP8). Mounted once in App; active only with a session and the
 * desktop bridge.
 *
 * Delivery — on the roll call, on mount and when the channel is back after
 * a loss, it goes through the claimable jobs oldest first: probe the folder,
 * claim, deliver, report. The database referees between copies, so a job
 * another copy claimed first is simply skipped.
 *
 * Removal — on the removal call, and at the same two moments after the
 * delivery pass, it asks the database which backups are due to leave the
 * folder, deletes each file and reports it. There is no claim: a file
 * already gone counts as removed, so two copies at it at once both succeed.
 *
 * One pass at a time; a nudge during a pass runs one more pass of its kind
 * after it. A failed delivery is reported — the job is free again for every
 * copy — and ends the pass until the next nudge; a folder that cannot be
 * reached ends a removal pass the same way. Silent throughout: this is
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
    // What a nudge asked for while a pass was running; delivery goes first.
    const wanted = { delivery: false, removal: false }

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

    const deliveryPass = async () => {
      const { sessionId, machine } = await bridge.identity()
      for (const job of await backupJobService.listClaimable()) {
        if (stopped) return
        const carryOn = await deliverJob(job, sessionId, machine)
        void queryClient.invalidateQueries({ queryKey: backupJobKeys.all })
        if (!carryOn) break
      }
    }

    const removalPass = async () => {
      const due = await backupJobService.listDueForRemoval()
      if (due.length === 0) return

      const { machine } = await bridge.identity()
      const settings = await backupSettingsService.get()
      const share = { server: settings.share_server, share: settings.share_name, folder: settings.share_folder }
      for (const job of due) {
        if (stopped) return
        // A folder this copy cannot reach ends the pass: another copy, or the next call, deletes the rest.
        const result = await bridge.remove({ share, fileName: job.storage_path })
        if (!result.ok) break
        await backupJobService.reportRemoved(job.id, machine)
        void queryClient.invalidateQueries({ queryKey: backupJobKeys.all })
      }
    }

    const run = async () => {
      if (running) return
      running = true
      try {
        while ((wanted.delivery || wanted.removal) && !stopped) {
          const next = wanted.delivery ? 'delivery' : 'removal'
          wanted[next] = false
          try {
            await (next === 'delivery' ? deliveryPass() : removalPass())
          } catch {
            // A pass that cannot reach the database waits for the next nudge.
          }
        }
      } finally {
        running = false
      }
    }

    const nudge = (kind: keyof typeof wanted) => {
      wanted[kind] = true
      void run()
    }

    const unsubscribe = backupJobService.subscribeToRollCall(
      () => nudge('delivery'),
      () => nudge('removal'),
    )
    nudge('delivery')
    nudge('removal')

    return () => {
      stopped = true
      unsubscribe()
    }
  }, [userId, queryClient])
}
