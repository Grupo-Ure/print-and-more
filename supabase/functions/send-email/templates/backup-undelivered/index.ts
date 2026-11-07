// backup-undelivered — tells the shop and the developers that a backup was
// made but has not reached the shop folder for undelivered_alert_days: no
// computer that can reach the folder has had the app open, or every delivery
// failed. Queued by fn_backup_upkeep at most once a day while that holds,
// one message per recipient (context.recipient: SHOP or DEVELOPER), with no
// order. The mail names the oldest such backup. Still needed only while one
// is still undelivered past the threshold, so a delivery in the meantime
// cancels it.

import type { EmailTemplate } from '../registry.ts'
import { formatDate } from '../context.ts'
import { alertRecipient, loadAlertSettings, oldestUndeliveredJob, wholeDaysSince } from '../backup.ts'

const backupUndelivered: EmailTemplate = {
  async stillNeeded(message, deps) {
    const settings = await loadAlertSettings(message, deps)
    return (await oldestUndeliveredJob(message, deps, settings.undelivered_alert_days)) !== null
  },
  async resolve(message, deps) {
    const recipient = alertRecipient(message)
    const settings = await loadAlertSettings(message, deps)
    const job = await oldestUndeliveredJob(message, deps, settings.undelivered_alert_days)
    if (!job) throw new Error('backup-undelivered: no backup is undelivered past the threshold')
    return {
      recipient,
      data: {
        period: job.period,
        madeAt: formatDate(job.created_at),
        waitedDays: wholeDaysSince(job.created_at),
        attempts: job.attempts,
      },
    }
  },
}

export default backupUndelivered
