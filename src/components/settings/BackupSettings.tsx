import { useState, type KeyboardEvent } from 'react'
import { useBackupSettings, useUpdateBackupSettings } from '../../queries/backupSettingsQueries'
import type { BackupSettingsPatch } from '../../services/backupSettingsService'
import { useToast } from '../Toast'
import { WholeNumberField } from '../fields/WholeNumberField'
import { SettingRow } from './SettingRow'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings.backups

/** The longest any day-based setting may be: a year. */
const MAX_DAYS = 365

/** The longest any minute-based setting may be: a day. */
const MAX_MINUTES = 1440

type ShareSetting = 'share_server' | 'share_name' | 'share_folder'

/**
 * Settings → Backups: when the weekly backup is made, how the running copies
 * of the app hand it on, when the shop is warned, and the folder on the shop's
 * share it is brought to (`backup_settings`). Each field saves on its own, the
 * moment it is left.
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
          description="How long a backup stays in online storage once it has reached the shop folder. The copy in the shop folder is not touched."
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
    </>
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
