// backup-missing — tells the shop and the developers that no new backup has
// been made for missing_backup_alert_days: the workflow was not started, or
// its runs fail. Queued by fn_backup_upkeep at most once a day while that
// holds and backups are switched on, one message per recipient
// (context.recipient: SHOP or DEVELOPER), with no order. Still needed only
// while it still holds, so a backup made in the meantime cancels it.

import type { EmailTemplate } from '../registry.ts'
import { formatDate } from '../context.ts'
import { alertRecipient, loadAlertSettings, madeMoreThan, newestJob, wholeDaysSince } from '../backup.ts'

const backupMissing: EmailTemplate = {
  async stillNeeded(message, deps) {
    const settings = await loadAlertSettings(message, deps)
    if (!settings.enabled) return false
    const newest = await newestJob(message, deps)
    return newest !== null && madeMoreThan(newest, settings.missing_backup_alert_days)
  },
  async resolve(message, deps) {
    const recipient = alertRecipient(message)
    const newest = await newestJob(message, deps)
    if (!newest) throw new Error('backup-missing: no backup has been made yet')
    return {
      recipient,
      data: {
        lastPeriod: newest.period,
        lastMadeAt: formatDate(newest.created_at),
        daysSince: wholeDaysSince(newest.created_at),
      },
    }
  },
}

export default backupMissing
