// What the backup runtime's alert mails look up at send time: who the
// message is for, the settings the upkeep judged by, and the jobs the
// condition is about. Shared by the backup-* templates.
//
// The messages carry no order and no job — only the recipient, SHOP or
// DEVELOPER — so everything else is read when the mail is claimed, and the
// condition is judged again by the template's stillNeeded: a backup that
// arrived in the meantime cancels the mail.

import type { EmailMessage, TemplateDeps } from './registry.ts'
import { UnsendableEmail } from './unsendable.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** The function secret each recipient's address is read from. */
const RECIPIENT_VARIABLES = {
  SHOP: 'EMAIL_SHOP_TO',
  DEVELOPER: 'EMAIL_DEVELOPER_TO',
} as const

/**
 * The address the message goes to. A message naming no known recipient, or
 * one whose variable is unset (a local or CI database without a developer
 * address), is unsendable: given up at once, not retried.
 */
export function alertRecipient(message: EmailMessage): string {
  const recipient = message.context.recipient
  if (recipient !== 'SHOP' && recipient !== 'DEVELOPER') {
    throw new UnsendableEmail(`${message.template}: the message names no recipient (SHOP or DEVELOPER)`)
  }
  const variable = RECIPIENT_VARIABLES[recipient]
  const address = Deno.env.get(variable)
  if (!address) throw new UnsendableEmail(`${message.template}: ${variable} is not set`)
  return address
}

/** The settings the alerts are judged by (`backup_settings`). */
export interface BackupAlertSettings {
  enabled: boolean
  undelivered_alert_days: number
  missing_backup_alert_days: number
}

/** A job as the alert mails name it. */
export interface BackupJobSummary {
  period: string
  created_at: string
  attempts: number
}

export async function loadAlertSettings(message: EmailMessage, { db }: TemplateDeps): Promise<BackupAlertSettings> {
  const { data, error } = await db
    .from('backup_settings')
    .select('enabled, undelivered_alert_days, missing_backup_alert_days')
    .single()
  if (error) throw new Error(`${message.template}: backup settings lookup failed: ${error.message}`)
  return data
}

/** The moment that many days back from now, as the upkeep's `now() - interval` has it. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

/** The oldest job not yet delivered that was made more than `days` ago, or null when there is none. */
export async function oldestUndeliveredJob(
  message: EmailMessage,
  { db }: TemplateDeps,
  days: number,
): Promise<BackupJobSummary | null> {
  const { data, error } = await db
    .from('backup_jobs')
    .select('period, created_at, attempts')
    .neq('state', 'DELIVERED')
    .lt('created_at', daysAgo(days))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`${message.template}: backup job lookup failed: ${error.message}`)
  return data
}

/** The newest job, or null before the first backup. */
export async function newestJob(message: EmailMessage, { db }: TemplateDeps): Promise<BackupJobSummary | null> {
  const { data, error } = await db
    .from('backup_jobs')
    .select('period, created_at, attempts')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`${message.template}: backup job lookup failed: ${error.message}`)
  return data
}

/** Whether the job was made more than `days` ago — the upkeep's test. */
export function madeMoreThan(job: BackupJobSummary, days: number): boolean {
  return Date.parse(job.created_at) < Date.now() - days * DAY_MS
}

/** Whole days since the timestamp. */
export function wholeDaysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / DAY_MS)
}
