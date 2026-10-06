/**
 * Shared form-field components on TanStack Form + Shadcn primitives.
 *
 * Each widget binds a Shadcn input to a TanStack `field` (for value state) and
 * shows an explicit `error` string. The error map comes from the form calling
 * `validateProduct(...)` directly — the widgets do no validation themselves.
 */

import { type AnyFieldApi } from '@tanstack/react-form'
import { useContext, useState, type ReactNode } from 'react'
import { ProductViewContext, SubmitAttemptedContext, useSubmitAttempted } from './formContexts'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import type { FileRow } from '../../../services/fileService'
import { FilePicker } from '../../FilePicker'
import { useRevealFile } from '../../../hooks/useRevealFile'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.orders.productDetail.basicInfo
const FILE_IDS = IDS.files

/** Marks an input for the e2e suite: one shared test ID, the field name as the instance key. */
const fieldTestAttrs = (field: AnyFieldApi) => ({ 'data-testid': IDS.field, 'data-field': field.name })

export function FieldRow({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const asString = (v: unknown): string => (v == null ? '' : String(v))

/**
 * The `<form>` every per-type form is wrapped in. It owns the submit-attempt
 * flag, so a freshly-opened form stays quiet and pressing Save is what asks it
 * to point at what is missing.
 */
export function FormShell({ children, onSubmit, className = 'flex flex-col gap-3' }: { children: ReactNode; onSubmit: () => void; className?: string }) {
  const [attempted, setAttempted] = useState(false)
  return (
    <SubmitAttemptedContext.Provider value={attempted}>
      <form
        onSubmit={event => {
          event.preventDefault()
          event.stopPropagation()
          setAttempted(true)
          onSubmit()
        }}
        className={className}
      >
        {children}
      </form>
    </SubmitAttemptedContext.Provider>
  )
}

/**
 * An error is surfaced once the user has blurred out of the field, or as soon as
 * Save has been pressed, so a freshly-opened (empty) form doesn't render every
 * required-field error up front. The raw error map still blocks the save, so
 * nothing invalid is written regardless.
 */
function useShownError(field: AnyFieldApi, error?: string): string | undefined {
  const attempted = useSubmitAttempted()
  return field.state.meta.isBlurred || attempted ? error : undefined
}

/** Single-line text (or numeric-as-text, to allow comma decimals). */
export function TextField({ field, label, error, hint, autoFocus }: { field: AnyFieldApi; label: string; error?: string; hint?: string; autoFocus?: boolean }) {
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown} hint={hint}>
      <Input
        id={field.name}
        name={field.name}
        {...fieldTestAttrs(field)}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        autoFocus={autoFocus}
        aria-invalid={shown ? true : undefined}
      />
    </FieldRow>
  )
}

export function TextareaField({ field, label, error, rows = 6, hint }: { field: AnyFieldApi; label: string; error?: string; rows?: number; hint?: string }) {
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown} hint={hint}>
      <Textarea
        id={field.name}
        name={field.name}
        {...fieldTestAttrs(field)}
        rows={rows}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value || null)}
        onBlur={field.handleBlur}
        aria-invalid={shown ? true : undefined}
      />
    </FieldRow>
  )
}

/** Optional integer input (e.g. quantity). Stores the raw string; the schema coerces. */
export function QuantityField({ field, label = 'Quantity', error, hint }: { field: AnyFieldApi; label?: string; error?: string; hint?: string }) {
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown} hint={hint}>
      <Input
        id={field.name}
        name={field.name}
        {...fieldTestAttrs(field)}
        type="number"
        min={1}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value === '' ? null : e.target.value)}
        onBlur={field.handleBlur}
        placeholder="—"
        aria-invalid={shown ? true : undefined}
      />
    </FieldRow>
  )
}

export function DateField({ field, label, error }: { field: AnyFieldApi; label: string; error?: string }) {
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown}>
      <Input
        id={field.name}
        name={field.name}
        {...fieldTestAttrs(field)}
        type="date"
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value || null)}
        onBlur={field.handleBlur}
        aria-invalid={shown ? true : undefined}
      />
    </FieldRow>
  )
}

export type Option = { value: string; label: string }

/** Shadcn Select bound to a string field. */
export function SelectField({ field, label, options, error, placeholder = '—' }: { field: AnyFieldApi; label: string; options: Option[]; error?: string; placeholder?: string }) {
  const current = asString(field.state.value)
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown}>
      <Select value={current || undefined} onValueChange={v => field.handleChange(v)}>
        <SelectTrigger className="w-full" aria-invalid={shown ? true : undefined} onBlur={field.handleBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}

/** Tri-state boolean (— / Yes / No) — preserves the explicit-unset semantics. */
export function BooleanField({ field, label, error }: { field: AnyFieldApi; label: string; error?: string }) {
  const v = field.state.value
  const current = v === true ? 'true' : v === false ? 'false' : undefined
  const shown = useShownError(field, error)
  return (
    <FieldRow label={label} htmlFor={field.name} error={shown}>
      <Select value={current} onValueChange={s => field.handleChange(s === 'true')}>
        <SelectTrigger className="w-full" aria-invalid={shown ? true : undefined} onBlur={field.handleBlur}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </FieldRow>
  )
}

/** Width × height pair. The OR-required message comes from the validator's
 *  synthetic `format` key, passed in as `formatError`. */
export function DimensionFields({
  widthField,
  heightField,
  formatError,
  unit = 'mm',
}: {
  widthField: AnyFieldApi
  heightField: AnyFieldApi
  formatError?: string
  unit?: string
}) {
  // The dimension error is a synthetic OR-required message spanning both inputs;
  // reveal it once either has been blurred, or once Save has been pressed.
  const attempted = useSubmitAttempted()
  const shown = attempted || widthField.state.meta.isBlurred || heightField.state.meta.isBlurred ? formatError : undefined
  return (
    <FieldRow label={`Dimensions (${unit})`} error={shown}>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Width"
          placeholder="Width"
          value={asString(widthField.state.value)}
          onChange={e => widthField.handleChange(e.target.value === '' ? null : e.target.value)}
          onBlur={widthField.handleBlur}
        />
        <span className="text-muted-foreground">×</span>
        <Input
          aria-label="Height"
          placeholder="Height"
          value={asString(heightField.state.value)}
          onChange={e => heightField.handleChange(e.target.value === '' ? null : e.target.value)}
          onBlur={heightField.handleBlur}
        />
      </div>
    </FieldRow>
  )
}

/**
 * Per-product file assignment: a chip per attached file over the shared
 * `FilePicker`. Artwork can be dropped straight onto the picker, so a product
 * no longer has to wait for the order's Files tab to hold the file first —
 * dropping links it to the order and attaches it to the product in one go.
 * In view mode only the chips remain (a dash while there are none).
 */
export function FilePickerField({ orderId, value, onChange, orderFiles }: { orderId: string; value: string[]; onChange: (next: string[]) => void; orderFiles: FileRow[] }) {
  const viewing = useContext(ProductViewContext)
  const attached = new Set(value)
  const revealFile = useRevealFile()
  return (
    <FieldRow label="Files">
      <div data-testid={FILE_IDS.root} className="flex flex-col gap-2">
        {(value.length > 0 || viewing) && (
          <div className="flex flex-wrap items-center gap-2">
            {viewing && value.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            {value.map(fid => {
              const file = orderFiles.find(f => f.id === fid)
              return (
              <Badge key={fid} data-testid={FILE_IDS.chip} data-file-id={fid} variant="secondary" className="gap-1">
                {file ? (
                  <button
                    type="button"
                    title={`Open in file manager\n${file.path}`}
                    onClick={() => void revealFile(file.path)}
                    className="max-w-45 cursor-pointer truncate rounded-sm hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {file.display_name}
                  </button>
                ) : (
                  <span className="max-w-45 truncate">{fid}</span>
                )}
                {!viewing && (
                  <button type="button" data-testid={FILE_IDS.chipRemove} className="cursor-pointer" title="Remove" onClick={() => onChange(value.filter(id => id !== fid))}>
                    ×
                  </button>
                )}
              </Badge>
              )
            })}
          </div>
        )}
        {!viewing && (
          <FilePicker
            orderId={orderId}
            orderFiles={orderFiles}
            hasPicks={value.length > 0}
            collapsedLabel="Attach another file"
            // A product holds a file once, so an attached one is listed as taken.
            isFilePicked={file => attached.has(file.id)}
            fileBadge={file => (attached.has(file.id) ? <Badge variant="outline">Attached</Badge> : null)}
            onPick={fileIds => onChange([...value, ...fileIds.filter(fid => !attached.has(fid))])}
          />
        )}
      </div>
    </FieldRow>
  )
}

/**
 * Cancel + Save. Save stays pressable while the form is incomplete: pressing it
 * is how the user asks which fields are missing (`FormShell` then reveals them).
 */
export function FormActions({ submitting, editing, onCancel }: { submitting: boolean; editing: boolean; onCancel: () => void }) {
  const viewing = useContext(ProductViewContext)
  if (viewing) return null
  return (
    <div className="flex gap-2 pt-1">
      <Button type="submit" data-testid={IDS.submit} disabled={submitting}>
        {submitting ? 'Saving…' : editing ? 'Save' : 'Add product'}
      </Button>
      <Button type="button" variant="outline" data-testid={IDS.cancel} onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
    </div>
  )
}
