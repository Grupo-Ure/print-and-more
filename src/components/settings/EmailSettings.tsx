import { useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { emailTemplateLabel } from '../../lib/emailTemplateLabels'
import { checkWording, wordingProblemMessage } from '../../lib/emailWording'
import { useEmailSettings, useUpdateEmailSetting } from '../../queries/emailSettingsQueries'
import type { EmailSetting, EmailSettingPatch } from '../../services/emailSettingsService'
import { useToast } from '../Toast'
import { WholeNumberField } from '../fields/WholeNumberField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
const DIALOG_IDS = IDS.wordingDialog

/** The most days a delay or a repeat interval may be; the database holds the same cap. */
const MAX_DAYS = 365

/** The ceiling of the `max_sends` column (smallint). */
const MAX_SENDS = 32_767

/**
 * Settings → Emails: one row per mail type (`email_settings`) — on or off,
 * the delay before it goes out, the repeat interval, the most times it is
 * sent, and its wording, edited in a dialog. A row is added by the migration
 * of the feature that owns the mail; this section lists whatever is there.
 * Every field saves on its own, the moment it is left; the wording saves from
 * its dialog.
 */
export function EmailSettings() {
  const { showError } = useToast()
  const { data: settings, isLoading } = useEmailSettings()
  const updateSetting = useUpdateEmailSetting()
  const [editingWording, setEditingWording] = useState<EmailSetting | null>(null)

  const save = (template: string, patch: EmailSettingPatch): Promise<unknown> =>
    updateSetting.mutateAsync({ template, patch }).catch(() => showError('Email setting could not be saved'))

  const isSaving = (template: string): boolean =>
    updateSetting.isPending && updateSetting.variables?.template === template

  return (
    <>
      <h1>Emails</h1>

      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="font-semibold">Mails</h2>
          <p className="text-xs text-neutral-500 desktop:text-sm">
            A changed delay applies to mail queued afterwards; a mail already waiting keeps the time
            it was queued with. The repeat interval and the maximum count from the next send on. A
            mail switched off is not sent, not even one already waiting. Changed wording goes out
            with the next mail sent, waiting ones included.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Mail</TableHead>
              <TableHead>On</TableHead>
              <TableHead>Delay (days)</TableHead>
              <TableHead>Repeat every (days)</TableHead>
              <TableHead>Sent at most</TableHead>
              <TableHead className="pr-4">Wording</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="pl-4 text-neutral-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (settings ?? []).length === 0 && (
              <TableRow data-testid={IDS.empty}>
                <TableCell colSpan={6} className="pl-4 text-neutral-500">
                  No mail is set up yet. A mail appears here once the feature that sends it is added.
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
                  onEditWording={() => setEditingWording(setting)}
                />
              ))}
          </TableBody>
        </Table>
      </section>

      {editingWording && (
        <WordingDialog
          key={editingWording.template}
          setting={editingWording}
          onClose={() => setEditingWording(null)}
          onSave={patch => updateSetting.mutateAsync({ template: editingWording.template, patch })}
        />
      )}
    </>
  )
}

function EmailSettingRow({
  setting,
  isSaving,
  onSave,
  onEditWording,
}: {
  setting: EmailSetting
  isSaving: boolean
  onSave: (patch: EmailSettingPatch) => Promise<unknown>
  onEditWording: () => void
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
      <TableCell>
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
      <TableCell className="pr-4">
        <Button
          data-testid={IDS.rowEditWording}
          variant="outline"
          size="sm"
          disabled={isSaving}
          title={setting.subject}
          onClick={onEditWording}
        >
          Edit wording
        </Button>
      </TableCell>
    </TableRow>
  )
}

type WordingField = 'subject' | 'body'

/**
 * A mail's subject and body, with the slots the mail offers as chips that
 * insert at the cursor of the field last focused. Save checks both fields
 * (`checkWording`): text and `{{name}}` slots from the row's list only, so
 * the sender's strict render cannot fail on what was saved here.
 */
function WordingDialog({
  setting,
  onClose,
  onSave,
}: {
  setting: EmailSetting
  onClose: () => void
  onSave: (patch: EmailSettingPatch) => Promise<unknown>
}) {
  const label = emailTemplateLabel(setting.template)
  const [subject, setSubject] = useState(setting.subject)
  const [body, setBody] = useState(setting.body)
  const [target, setTarget] = useState<WordingField>('body')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertPlaceholder(name: string) {
    const slot = `{{${name}}}`
    const field = target === 'subject' ? subjectRef.current : bodyRef.current
    const value = target === 'subject' ? subject : body
    const start = field?.selectionStart ?? value.length
    const end = field?.selectionEnd ?? value.length
    const next = value.slice(0, start) + slot + value.slice(end)
    if (target === 'subject') setSubject(next)
    else setBody(next)
    // After React has written the new value, put the caret behind the slot.
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(start + slot.length, start + slot.length)
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const subjectCheck = checkWording(subject, setting.placeholders)
    if (!subjectCheck.ok) {
      setError(`Subject: ${wordingProblemMessage(subjectCheck.problem)}`)
      return
    }
    const bodyCheck = checkWording(body, setting.placeholders)
    if (!bodyCheck.ok) {
      setError(`Text: ${wordingProblemMessage(bodyCheck.problem)}`)
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSave({ subject, body })
      onClose()
    } catch {
      setError('The wording could not be saved.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && !saving && onClose()}>
      <DialogContent data-testid={DIALOG_IDS.root} data-template={setting.template} className="desktop:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wording: {label}</DialogTitle>
          <DialogDescription>
            Plain text. A blank line starts a new paragraph. A placeholder is filled in when the mail
            is sent; click one to insert it where the cursor is.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-wording-subject">Subject</Label>
            <Input
              id="email-wording-subject"
              data-testid={DIALOG_IDS.subject}
              ref={subjectRef}
              value={subject}
              onChange={event => setSubject(event.target.value)}
              onFocus={() => setTarget('subject')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-wording-body">Text</Label>
            <Textarea
              id="email-wording-body"
              data-testid={DIALOG_IDS.body}
              ref={bodyRef}
              rows={10}
              className="max-h-[50vh]"
              value={body}
              onChange={event => setBody(event.target.value)}
              onFocus={() => setTarget('body')}
            />
          </div>

          {setting.placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-500">Placeholders:</span>
              {setting.placeholders.map(name => (
                <Button
                  key={name}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="font-mono"
                  data-testid={DIALOG_IDS.placeholder}
                  data-placeholder={name}
                  onClick={() => insertPlaceholder(name)}
                >
                  {`{{${name}}}`}
                </Button>
              ))}
            </div>
          )}

          {error && (
            <div
              data-testid={DIALOG_IDS.error}
              className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid={DIALOG_IDS.cancel}
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" data-testid={DIALOG_IDS.submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save wording'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
