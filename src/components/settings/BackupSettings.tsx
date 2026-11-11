import { useState, type KeyboardEvent } from 'react'
import { formatDateTimeHuman } from '../../lib/formatDate'
import { useBackupJobs, useBackupMachine } from '../../queries/backupJobQueries'
import { useBackupSettings, useUpdateBackupSettings } from '../../queries/backupSettingsQueries'
import type { BackupJob } from '../../services/backupJobService'
import type { BackupSettings as BackupSettingsRow, BackupSettingsPatch } from '../../services/backupSettingsService'
import { useToast } from '../Toast'
import { WholeNumberField } from '../fields/WholeNumberField'
import { SettingRow } from './SettingRow'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings.backups
const JOB_IDS = IDS.jobs
const MACHINE_IDS = IDS.machine

/** The longest any day-based setting may be: a year. */
const MAX_DAYS = 365

/** The longest the last backup of a month may be kept. */
const MAX_YEARS = 30

/** The longest any minute-based setting may be: a day. */
const MAX_MINUTES = 1440

type ShareSetting = 'share_server' | 'share_name' | 'share_folder'

/**
 * Settings → Backups, in three parts: every backup ever made and where it is
 * (`backup_jobs`, live); the settings — when the weekly backup is made, how
 * the running copies of the app hand it on, when the shop is warned, how long
 * it is kept in the shop folder, and the folder on the shop's share it is
 * brought to (`backup_settings`), each field
 * saving on its own the moment it is left; and whether this machine can reach
 * that folder now.
 */
export function BackupSettings() {
  const { showError } = useToast()
  const { data: settings } = useBackupSettings()
  const updateSettings = useUpdateBackupSettings()

  const save = (patch: BackupSettingsPatch): Promise<unknown> =>
    updateSettings.mutateAsync(patch).catch(() => showError('Backup setting could not be saved'))

  const isSaving = (setting: keyof BackupSettingsPatch): boolean =>
    updateSettings.isPending && updateSettings.variables?.[setting] !== undefined

  const numberField = (
    setting: Exclude<keyof BackupSettingsPatch, 'enabled' | ShareSetting>,
    testId: string,
    label: string,
    max: number,
  ) => (
    <WholeNumberField
      testId={testId}
      label={label}
      value={settings?.[setting] ?? null}
      min={1}
      max={max}
      disabled={!settings || isSaving(setting)}
      onSave={next => save({ [setting]: next ?? undefined })}
    />
  )

  const shareField = (setting: ShareSetting, testId: string, label: string, placeholder: string) => (
    <TextSettingField
      testId={testId}
      label={label}
      placeholder={placeholder}
      value={settings?.[setting] ?? null}
      disabled={!settings || isSaving(setting)}
      onSave={next => save({ [setting]: next })}
    />
  )

  return (
    <>
      <h1>Backups</h1>

      <BackupJobList settings={settings ?? null} />

      <h2>Settings</h2>
      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <SettingRow
          title="Make backups"
          description="Off pauses new backups and their announcement. A backup already made is still brought to the shop folder."
        >
          <Switch
            data-testid={IDS.enabled}
            aria-label="Make backups"
            checked={settings?.enabled ?? false}
            disabled={!settings || isSaving('enabled')}
            onCheckedChange={checked => void save({ enabled: checked })}
          />
        </SettingRow>
        <SettingRow
          title="Back up every (days)"
          description="A new backup is made once the newest one is this many days old."
        >
          {numberField('dump_interval_days', IDS.dumpIntervalDays, 'Make a backup every so many days', MAX_DAYS)}
        </SettingRow>
        <SettingRow
          title="Wait for a started backup (minutes)"
          description="How long no new backup is started while one that was started has not finished or reported a failure. A backup normally takes under an hour."
        >
          {numberField(
            'start_wait_minutes',
            IDS.startWaitMinutes,
            'Wait so many minutes for a started backup before starting another',
            MAX_MINUTES,
          )}
        </SettingRow>
        <SettingRow
          title="Claim holds for (minutes)"
          description="How long a computer that took a backup has to bring it to the shop folder before another may try. Fixed when it is taken."
        >
          {numberField('lease_minutes', IDS.leaseMinutes, 'A claim on a backup holds for so many minutes', MAX_MINUTES)}
        </SettingRow>
        <SettingRow
          title="Announce again after (minutes)"
          description="How long a backup may wait untaken before the running computers are asked again."
        >
          {numberField(
            'reannounce_minutes',
            IDS.reannounceMinutes,
            'Announce a waiting backup again after so many minutes',
            MAX_MINUTES,
          )}
        </SettingRow>
        <SettingRow
          title="Keep the online copy for (days after delivery)"
          description="How long a backup stays in online storage once it has reached the shop folder. The copy in the shop folder has its own keep, below."
        >
          {numberField(
            'holding_retention_days',
            IDS.holdingRetentionDays,
            'Keep the online copy for so many days after delivery',
            MAX_DAYS,
          )}
        </SettingRow>
        <SettingRow
          title="Warn when undelivered for (days)"
          description="A mail goes out when a backup has not reached the shop folder for this many days."
        >
          {numberField(
            'undelivered_alert_days',
            IDS.undeliveredAlertDays,
            'Warn when a backup is undelivered for so many days',
            MAX_DAYS,
          )}
        </SettingRow>
        <SettingRow
          title="Warn when no backup for (days)"
          description="A mail goes out when no new backup has been made for this many days."
        >
          {numberField(
            'missing_backup_alert_days',
            IDS.missingBackupAlertDays,
            'Warn when no backup has been made for so many days',
            MAX_DAYS,
          )}
        </SettingRow>
        <SettingRow
          title="Keep backups in the shop folder for (days)"
          description="How long after it was made a backup is deleted from the shop folder. The last backup of each month is kept longer, and the newest one always stays."
        >
          {numberField(
            'weekly_retention_days',
            IDS.weeklyRetentionDays,
            'Keep a backup in the shop folder for so many days',
            MAX_DAYS,
          )}
        </SettingRow>
        <SettingRow
          title="Keep each month's last backup for (years)"
          description="How long the last backup of a month stays in the shop folder before it is deleted too."
        >
          {numberField(
            'monthly_retention_years',
            IDS.monthlyRetentionYears,
            'Keep the last backup of a month for so many years',
            MAX_YEARS,
          )}
        </SettingRow>
        <SettingRow
          title="Server"
          description="The file server the shop folder is on. While server, share or folder is empty, no computer brings backups in."
        >
          {shareField('share_server', IDS.shareServer, 'Server of the shop folder', 'Server')}
        </SettingRow>
        <SettingRow title="Share" description="The shared drive on that server.">
          {shareField('share_name', IDS.shareName, 'Share of the shop folder', 'Server A-Z')}
        </SettingRow>
        <SettingRow
          title="Folder"
          description="The app's folder on that share. Backups go in its Backups subfolder, created when missing."
        >
          {shareField('share_folder', IDS.shareFolder, 'Folder of the app on the share', 'Print And More')}
        </SettingRow>
      </section>

      <h2>This computer</h2>
      <ThisMachine settings={settings ?? null} />
    </>
  )
}

const STATE_LABELS: Record<BackupJob['state'], string> = {
  WAITING: 'Waiting',
  TAKEN: 'Being delivered',
  DELIVERED: 'Delivered',
}

/** Bytes in the unit a person reads: "820 KB", "1.8 MB", "2.4 GB". */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${unit === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days since the job was made. */
function daysSinceMade(job: BackupJob, now: number): number {
  return Math.floor((now - Date.parse(job.created_at)) / DAY_MS)
}

/** Whether the job was made more than `days` ago — the upkeep's test for both alert mails. */
function madeMoreThan(job: BackupJob, days: number, now: number): boolean {
  return Date.parse(job.created_at) < now - days * DAY_MS
}

/**
 * Every backup ever made, newest first: what it is, where it is, and what went
 * wrong on the way. The two conditions the upkeep mails about are flagged on
 * the rows that earn them, from the same settings: a job not yet delivered
 * past `undelivered_alert_days`, and — while backups are on — the newest job
 * past `missing_backup_alert_days`.
 */
function BackupJobList({ settings }: { settings: BackupSettingsRow | null }) {
  // The ages are judged as of the list's last fetch, which every change to a job triggers.
  const { data: jobs, isLoading, dataUpdatedAt: now } = useBackupJobs()

  return (
    <section data-testid={JOB_IDS.root} className="overflow-x-auto rounded-md border border-neutral-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Week</TableHead>
            <TableHead>Made</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Taken by</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead>Failed tries</TableHead>
            <TableHead>Last error</TableHead>
            <TableHead>Online copy</TableHead>
            <TableHead className="pr-4">Shop folder copy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && jobs?.length === 0 && (
            <TableRow>
              <TableCell data-testid={JOB_IDS.empty} colSpan={10} className="pl-4 text-neutral-500">
                No backup has been made yet.
              </TableCell>
            </TableRow>
          )}
          {jobs?.map((job, index) => (
            <BackupJobRow
              key={job.id}
              job={job}
              now={now}
              isUndelivered={
                settings !== null &&
                job.state !== 'DELIVERED' &&
                madeMoreThan(job, settings.undelivered_alert_days, now)
              }
              isMissingNext={
                settings !== null &&
                settings.enabled &&
                index === 0 &&
                madeMoreThan(job, settings.missing_backup_alert_days, now)
              }
            />
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function BackupJobRow({
  job,
  now,
  isUndelivered,
  isMissingNext,
}: {
  job: BackupJob
  now: number
  /** Not yet delivered, made longer ago than the undelivered alert threshold. */
  isUndelivered: boolean
  /** The newest job, made longer ago than the missing-backup alert threshold: the next one is overdue. */
  isMissingNext: boolean
}) {
  const isPurged = job.purged_at !== null
  const isRemoved = job.removed_at !== null
  const days = daysSinceMade(job, now)
  return (
    <TableRow data-testid={JOB_IDS.row} data-job-id={job.id} data-state={job.state}>
      <TableCell className="pl-4 font-medium">{job.period}</TableCell>
      <TableCell>
        {formatDateTimeHuman(job.created_at)}
        {isMissingNext && (
          <span data-testid={JOB_IDS.rowMissingFlag} data-days={days} className="block text-xs font-medium text-red-600">
            No backup for {days} days
          </span>
        )}
      </TableCell>
      <TableCell>{formatSize(job.size_bytes)}</TableCell>
      <TableCell>
        {STATE_LABELS[job.state as BackupJob['state']] ?? job.state}
        {isUndelivered && (
          <span data-testid={JOB_IDS.rowUndeliveredFlag} data-days={days} className="block text-xs font-medium text-red-600">
            Undelivered for {days} days
          </span>
        )}
      </TableCell>
      <TableCell>
        <span data-testid={JOB_IDS.rowTakenBy}>{job.claimed_by_machine ?? ''}</span>
        {job.state === 'TAKEN' && job.lease_until && (
          <span className="block text-xs text-neutral-500">until {formatDateTimeHuman(job.lease_until)}</span>
        )}
      </TableCell>
      <TableCell>
        <span data-testid={JOB_IDS.rowDeliveredBy}>{job.delivered_by_machine ?? ''}</span>
        {job.delivered_at && (
          <span className="block text-xs text-neutral-500">{formatDateTimeHuman(job.delivered_at)}</span>
        )}
      </TableCell>
      <TableCell data-testid={JOB_IDS.rowAttempts} data-value={job.attempts}>
        {job.attempts}
      </TableCell>
      <TableCell data-testid={JOB_IDS.rowLastError} className="max-w-64 truncate" title={job.last_error ?? undefined}>
        {job.last_error ?? ''}
      </TableCell>
      <TableCell data-testid={JOB_IDS.rowHoldingCopy} data-purged={isPurged}>
        {isPurged ? `Deleted ${formatDateTimeHuman(job.purged_at!)}` : 'Kept'}
      </TableCell>
      <TableCell
        data-testid={JOB_IDS.rowShopCopy}
        data-removed={job.state === 'DELIVERED' ? isRemoved : undefined}
        className="pr-4"
      >
        {job.state === 'DELIVERED' && (isRemoved ? `Deleted ${formatDateTimeHuman(job.removed_at!)}` : 'Kept')}
        {isRemoved && <span className="block text-xs text-neutral-500">by {job.removed_by_machine}</span>}
      </TableCell>
    </TableRow>
  )
}

/** This computer's name, whether it can reach the shop folder right now, and the folder it resolved. */
function ThisMachine({ settings }: { settings: BackupSettingsRow | null }) {
  const share = settings
    ? { server: settings.share_server, share: settings.share_name, folder: settings.share_folder }
    : null
  const { data } = useBackupMachine(share)

  if (!window.pam) {
    return (
      <section data-testid={MACHINE_IDS.root} className="rounded-md border border-neutral-200 px-4 py-3 text-neutral-500">
        Only the desktop app brings backups to the shop folder.
      </section>
    )
  }

  const reachable = data?.folder.reachable ?? false
  return (
    <section data-testid={MACHINE_IDS.root} className="rounded-md border border-neutral-200">
      <SettingRow title="Name" description="How this computer appears in the list above when it takes a backup.">
        <span data-testid={MACHINE_IDS.name} className="font-medium">
          {data?.machine ?? '…'}
        </span>
      </SettingRow>
      <SettingRow
        title="Shop folder"
        description={
          data && !data.folder.reachable ? data.folder.reason : 'Whether this computer can bring backups in right now.'
        }
      >
        <span
          data-testid={MACHINE_IDS.status}
          data-reachable={reachable}
          className={cn('font-medium', reachable ? 'text-green-700' : 'text-neutral-500')}
        >
          {data ? (reachable ? 'Reachable' : 'Not reachable') : '…'}
        </span>
      </SettingRow>
      <SettingRow title="Folder" description="Where backups go on this computer.">
        <span data-testid={MACHINE_IDS.path} className="font-mono text-xs break-all">
          {data?.folder.path ?? '—'}
        </span>
      </SettingRow>
    </section>
  )
}

/**
 * A text input that saves when it is left (or on Enter) and only then, as
 * `WholeNumberField` does: typing edits a draft, Escape drops it. Blank saves
 * `null`. `data-value` always carries the stored text, not the draft.
 */
function TextSettingField({
  testId,
  label,
  placeholder,
  value,
  disabled,
  onSave,
}: {
  testId: string
  label: string
  placeholder: string
  value: string | null
  disabled: boolean
  onSave: (next: string | null) => Promise<unknown>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const stored = value ?? ''

  const commit = () => {
    if (draft === null) return
    const next = draft.trim() === '' ? null : draft.trim()
    if (next === value) {
      setDraft(null)
      return
    }
    // The draft stays on screen while the save runs; the stored value replaces it after.
    void onSave(next).finally(() => setDraft(null))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Input
      data-testid={testId}
      data-value={stored}
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? stored}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="h-8 w-48 text-sm"
    />
  )
}
