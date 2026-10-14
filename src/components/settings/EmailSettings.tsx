import { useState, type KeyboardEvent } from 'react'
import { emailTemplateLabel } from '../../lib/emailTemplateLabels'
import { useEmailSettings, useUpdateEmailSetting } from '../../queries/emailSettingsQueries'
import type { EmailSetting, EmailSettingPatch } from '../../services/emailSettingsService'
import { useToast } from '../Toast'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings.emails

/** The most days a delay or a repeat interval may be; the database holds the same cap. */
const MAX_DAYS = 365

/** The ceiling of the `max_sends` column (smallint). */
const MAX_SENDS = 32_767

/**
 * Settings → Emails: one row per delayed or repeating mail (`email_settings`)
 * — on or off, the delay before it goes out, the repeat interval, the most
 * times it is sent. A row is added by the migration of the feature that owns
 * the mail; this section lists whatever is there. Every field saves on its
 * own, the moment it is left.
 */
export function EmailSettings() {
  const { showError } = useToast()
  const { data: settings, isLoading } = useEmailSettings()
  const updateSetting = useUpdateEmailSetting()

  const save = (template: string, patch: EmailSettingPatch): Promise<unknown> =>
    updateSetting.mutateAsync({ template, patch }).catch(() => showError('Email setting could not be saved'))

  const isSaving = (template: string): boolean =>
    updateSetting.isPending && updateSetting.variables?.template === template

  return (
    <>
      <h1>Emails</h1>

      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="font-semibold">Delayed and repeating mails</h2>
          <p className="text-xs text-neutral-500 desktop:text-sm">
            A changed delay applies to mail queued afterwards; a mail already waiting keeps the time
            it was queued with. The repeat interval and the maximum count from the next send on. A
            mail switched off is not sent, not even one already waiting.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Mail</TableHead>
              <TableHead>On</TableHead>
              <TableHead>Delay (days)</TableHead>
              <TableHead>Repeat every (days)</TableHead>
              <TableHead className="pr-4">Sent at most</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="pl-4 text-neutral-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (settings ?? []).length === 0 && (
              <TableRow data-testid={IDS.empty}>
                <TableCell colSpan={5} className="pl-4 text-neutral-500">
                  No mail has settings yet. A delayed or repeating mail appears here once the feature
                  that sends it is added.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              (settings ?? []).map(setting => (
                <EmailSettingRow
                  key={setting.template}
                  setting={setting}
                  isSaving={isSaving(setting.template)}
                  onSave={patch => save(setting.template, patch)}
                />
              ))}
          </TableBody>
        </Table>
      </section>
    </>
  )
}

function EmailSettingRow({
  setting,
  isSaving,
  onSave,
}: {
  setting: EmailSetting
  isSaving: boolean
  onSave: (patch: EmailSettingPatch) => Promise<unknown>
}) {
  const label = emailTemplateLabel(setting.template)
  const repeats = setting.repeat_days !== null

  return (
    <TableRow data-testid={IDS.row} data-template={setting.template}>
      <TableCell className="pl-4">{label}</TableCell>
      <TableCell>
        <Switch
          data-testid={IDS.rowEnabled}
          aria-label={`Send ${label}`}
          checked={setting.is_enabled}
          disabled={isSaving}
          onCheckedChange={checked => void onSave({ is_enabled: checked })}
        />
      </TableCell>
      <TableCell>
        <WholeNumberField
          testId={IDS.rowDelay}
          label={`${label}: delay in days`}
          value={setting.delay_days}
          min={0}
          max={MAX_DAYS}
          disabled={isSaving}
          onSave={next => onSave({ delay_days: next ?? 0 })}
        />
      </TableCell>
      <TableCell>
        <WholeNumberField
          testId={IDS.rowRepeat}
          label={`${label}: repeat every so many days`}
          value={setting.repeat_days}
          min={1}
          max={MAX_DAYS}
          allowEmpty
          placeholder="Once"
          disabled={isSaving}
          onSave={next => onSave({ repeat_days: next })}
        />
      </TableCell>
      <TableCell className="pr-4">
        <WholeNumberField
          testId={IDS.rowMaxSends}
          label={`${label}: sent at most so many times`}
          value={setting.max_sends}
          min={1}
          max={MAX_SENDS}
          disabled={isSaving || !repeats}
          title={repeats ? undefined : 'Sent once — set a repeat interval first'}
          onSave={next => onSave({ max_sends: next ?? 1 })}
        />
      </TableCell>
    </TableRow>
  )
}

/**
 * A number input that saves when it is left (or on Enter) and only then:
 * typing edits a draft, Escape drops it. A value outside `min`…`max`, or a
 * fraction, is refused with a toast and the stored value comes back. Empty
 * saves `null` where `allowEmpty` permits it. `data-value` always carries the
 * stored value, not the draft.
 */
function WholeNumberField({
  testId,
  label,
  value,
  min,
  max,
  allowEmpty = false,
  placeholder,
  disabled,
  title,
  onSave,
}: {
  testId: string
  label: string
  value: number | null
  min: number
  max: number
  allowEmpty?: boolean
  placeholder?: string
  disabled: boolean
  title?: string
  onSave: (next: number | null) => Promise<unknown>
}) {
  const { showError } = useToast()
  const [draft, setDraft] = useState<string | null>(null)
  const stored = value === null ? '' : String(value)

  const commit = () => {
    if (draft === null) return
    const trimmed = draft.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    const isValid = next === null ? allowEmpty : Number.isInteger(next) && next >= min && next <= max
    if (!isValid) {
      showError(`Enter a whole number from ${min} to ${max}${allowEmpty ? ', or leave it empty' : ''}`)
      setDraft(null)
      return
    }
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
      type="number"
      inputMode="numeric"
      step={1}
      min={min}
      max={max}
      data-testid={testId}
      data-value={stored}
      aria-label={label}
      title={title}
      placeholder={placeholder}
      value={draft ?? stored}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="h-8 w-24 text-sm"
    />
  )
}
