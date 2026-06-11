/**
 * Shared form-field components on TanStack Form + Shadcn primitives.
 *
 * Each field component receives a TanStack `field` (the render-prop API from
 * `<form.Field>`) and binds a Shadcn input to it, surfacing the field's error via
 * `fieldError(field.state.meta)` — the same idiom as `CustomerDialog`.
 */

import { type AnyFieldApi } from '@tanstack/react-form'
import type { ReactNode } from 'react'
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
import { fieldError, firstErrorMessage } from './shared'

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

/** Single-line text (or numeric-as-text, to allow comma decimals). */
export function TextField({ field, label, hint, autoFocus }: { field: AnyFieldApi; label: string; hint?: string; autoFocus?: boolean }) {
  return (
    <FieldRow label={label} htmlFor={field.name} error={fieldError(field.state.meta)} hint={hint}>
      <Input
        id={field.name}
        name={field.name}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        autoFocus={autoFocus}
        aria-invalid={fieldError(field.state.meta) ? true : undefined}
      />
    </FieldRow>
  )
}

export function TextareaField({ field, label, rows = 6, hint }: { field: AnyFieldApi; label: string; rows?: number; hint?: string }) {
  return (
    <FieldRow label={label} htmlFor={field.name} error={fieldError(field.state.meta)} hint={hint}>
      <Textarea
        id={field.name}
        name={field.name}
        rows={rows}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value || null)}
        onBlur={field.handleBlur}
        aria-invalid={fieldError(field.state.meta) ? true : undefined}
      />
    </FieldRow>
  )
}

/** Optional integer input (e.g. quantity). Stores the raw string; the schema coerces. */
export function QuantityField({ field, label = 'Quantity', hint }: { field: AnyFieldApi; label?: string; hint?: string }) {
  return (
    <FieldRow label={label} htmlFor={field.name} error={fieldError(field.state.meta)} hint={hint}>
      <Input
        id={field.name}
        name={field.name}
        type="number"
        min={1}
        value={asString(field.state.value)}
        onChange={e => field.handleChange(e.target.value === '' ? null : e.target.value)}
        onBlur={field.handleBlur}
        placeholder="—"
        aria-invalid={fieldError(field.state.meta) ? true : undefined}
      />
    </FieldRow>
  )
}

export type Option = { value: string; label: string }

/** Shadcn Select bound to a string field. */
export function SelectField({ field, label, options, placeholder = '—' }: { field: AnyFieldApi; label: string; options: Option[]; placeholder?: string }) {
  const error = fieldError(field.state.meta)
  const current = asString(field.state.value)
  return (
    <FieldRow label={label} htmlFor={field.name} error={error}>
      <Select value={current || undefined} onValueChange={v => field.handleChange(v)}>
        <SelectTrigger className="w-full" aria-invalid={error ? true : undefined} onBlur={field.handleBlur}>
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
export function BooleanField({ field, label }: { field: AnyFieldApi; label: string }) {
  const error = fieldError(field.state.meta)
  const v = field.state.value
  const current = v === true ? 'true' : v === false ? 'false' : undefined
  return (
    <FieldRow label={label} htmlFor={field.name} error={error}>
      <Select value={current} onValueChange={s => field.handleChange(s === 'true')}>
        <SelectTrigger className="w-full" aria-invalid={error ? true : undefined} onBlur={field.handleBlur}>
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

/** Width × height pair. `formatField` is a registered (input-less) field that
 *  receives the synthetic OR-required `format` error; it's shown untouched. */
export function DimensionFields({
  widthField,
  heightField,
  formatField,
  unit = 'mm',
}: {
  widthField: AnyFieldApi
  heightField: AnyFieldApi
  formatField: AnyFieldApi
  unit?: string
}) {
  return (
    <FieldRow label={`Dimensions (${unit})`} error={firstErrorMessage(formatField.state.meta.errors)}>
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

/** Per-product file assignment: chips for the selected files + a picker to add more. */
export function FilePickerField({ value, onChange, orderFiles }: { value: string[]; onChange: (next: string[]) => void; orderFiles: FileRow[] }) {
  if (orderFiles.length === 0) return null
  const available = orderFiles.filter(f => !value.includes(f.id))
  return (
    <FieldRow label="Files">
      <div className="flex flex-wrap items-center gap-2">
        {value.map(fid => (
          <Badge key={fid} variant="secondary" className="gap-1">
            <span className="max-w-45 truncate">{orderFiles.find(f => f.id === fid)?.display_name ?? fid}</span>
            <button type="button" className="cursor-pointer" title="Remove" onClick={() => onChange(value.filter(id => id !== fid))}>
              ×
            </button>
          </Badge>
        ))}
        {available.length > 0 && (
          <Select key={value.join('|')} value={undefined} onValueChange={fid => onChange([...value, fid])}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="Add file…" />
            </SelectTrigger>
            <SelectContent>
              {available.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </FieldRow>
  )
}

/** Cancel + Save (Save gated on form validity + the submitting flag). */
export function FormActions({ canSubmit, submitting, editing, onCancel }: { canSubmit: boolean; submitting: boolean; editing: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <Button type="submit" disabled={!canSubmit || submitting}>
        {submitting ? 'Saving…' : editing ? 'Save' : 'Add product'}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
    </div>
  )
}
