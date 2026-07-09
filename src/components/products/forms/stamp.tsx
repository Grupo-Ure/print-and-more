/** Stamp department forms (9 types). */

import { useEffect, useState } from 'react'
import { useForm, type AnyFieldApi } from '@tanstack/react-form'
import { validateProduct } from '../../../lib/products/registry'
import {
  modelStampToChild,
  classicStampToChild,
  stampPlateToChild,
  refillInkToChild,
  inkPadToChild,
  trodatPadToChild,
} from '../../../lib/products/schemas/stamp'
import { STAMP_COLORS, STAMP_COLOR_LABELS } from '../../../types/stamp'
import { stampService } from '../../../services/stampService'
import { useProductSubmit, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { DimensionFields, FilePickerField, FormActions, QuantityField, SelectField, TextareaField, TextField, type Option } from './fields'

type Errs = Record<string, string>

const CLASSIC_COLOR_OPTS: Option[] = STAMP_COLORS.map(c => ({ value: c, label: STAMP_COLOR_LABELS[c as keyof typeof STAMP_COLOR_LABELS] ?? c }))
const REFILL_COLOR_OPTS: Option[] = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'].map(c => ({ value: c, label: STAMP_COLOR_LABELS[c as keyof typeof STAMP_COLOR_LABELS] ?? c }))
const INK_TYPE_OPTS: Option[] = [{ value: 'NORMAL', label: 'Normal' }, { value: 'HAUTVERTRAEGLICH', label: 'Skin-friendly' }, { value: 'TEXTIL', label: 'Textile' }]
const PAD_SIZE_OPTS: Option[] = [{ value: 'KLEIN', label: 'Small' }, { value: 'MITTEL', label: 'Medium' }, { value: 'GROSS', label: 'Large' }]

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

/** Async model picker for TRODAT_PRINTY / WOODEN_STAMP (binds `model_id`). */
function ModelSelect({ field, type, error }: { field: AnyFieldApi; type: string; error?: string }) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let alive = true
    stampService.getStampModelsByType(type).then(rows => { if (alive) setModels(rows.map(r => ({ id: r.id, name: r.name }))) }).catch(() => {})
    return () => { alive = false }
  }, [type])
  return <SelectField field={field} label="Stamp model" options={models.map(m => ({ value: m.id, label: m.name }))} error={error} placeholder="Select a model…" />
}

/** Async cushion-variant picker for TRODAT_PAD (binds `pad_variant_id`). */
function CushionVariantSelect({ field, articleNumber, error }: { field: AnyFieldApi; articleNumber: string; error?: string }) {
  const [cushions, setCushions] = useState<{ id: string; color: string | null; stock: number | null }[]>([])
  useEffect(() => {
    if (!articleNumber) return
    let alive = true
    stampService.getCushionsByArticleNumber(articleNumber).then(rows => { if (alive) setCushions(rows.map(r => ({ id: r.id, color: r.color, stock: r.stock }))) }).catch(() => {})
    return () => { alive = false }
  }, [articleNumber])
  const options = articleNumber ? cushions.map(c => ({ value: c.id, label: `${c.color ?? '—'} (stock ${c.stock ?? 0})` })) : []
  return <SelectField field={field} label="Colour variant" options={options} error={error} />
}

// ---------------------------------------------------------------------------
// TRODAT_PRINTY / WOODEN_STAMP — model_id + classic color/description.
// ---------------------------------------------------------------------------

function ModelStampForm(p: ProductFormProps & { type: 'TRODAT_PRINTY' | 'WOODEN_STAMP' }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, p.type, modelStampToChild)
  const form = useForm({
    defaultValues: { model_id: '', color: '', color_other: '', description: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct(p.type, values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="model_id">{f => <ModelSelect field={f} type={p.type} error={errors.model_id} />}</form.Field>
              <form.Field name="color">{f => <SelectField field={f} label="Colour" options={CLASSIC_COLOR_OPTS} error={errors.color} />}</form.Field>
              {values.color === 'SONSTIGE' && <form.Field name="color_other">{f => <TextField field={f} label="Colour (other)" error={errors.color_other} />}</form.Field>}
              <form.Field name="description">{f => <TextareaField field={f} label="Description" rows={3} error={errors.description} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export const TrodatPrintyForm = (p: ProductFormProps) => <ModelStampForm {...p} type="TRODAT_PRINTY" />
export const WoodenStampForm = (p: ProductFormProps) => <ModelStampForm {...p} type="WOODEN_STAMP" />

// ---------------------------------------------------------------------------
// STAND_STAMP / DATE_STAMP / OTHER_STAMP — dimensions + classic color/description.
// ---------------------------------------------------------------------------

function ClassicStampForm(p: ProductFormProps & { type: 'STAND_STAMP' | 'DATE_STAMP' | 'OTHER_STAMP' }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, p.type, classicStampToChild)
  const form = useForm({
    defaultValues: { width: '', height: '', color: '', color_other: '', description: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct(p.type, values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format ?? errors.width ?? errors.height} />}</form.Field>}</form.Field>
              <form.Field name="color">{f => <SelectField field={f} label="Colour" options={CLASSIC_COLOR_OPTS} error={errors.color} />}</form.Field>
              {values.color === 'SONSTIGE' && <form.Field name="color_other">{f => <TextField field={f} label="Colour (other)" error={errors.color_other} />}</form.Field>}
              <form.Field name="description">{f => <TextareaField field={f} label="Description" rows={3} error={errors.description} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export const StandStampForm = (p: ProductFormProps) => <ClassicStampForm {...p} type="STAND_STAMP" />
export const DateStampForm = (p: ProductFormProps) => <ClassicStampForm {...p} type="DATE_STAMP" />
export const OtherStampForm = (p: ProductFormProps) => <ClassicStampForm {...p} type="OTHER_STAMP" />

// ---------------------------------------------------------------------------
// STAMP_PLATE
// ---------------------------------------------------------------------------

export function StampPlateForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'STAMP_PLATE', stampPlateToChild)
  const form = useForm({
    defaultValues: { width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('STAMP_PLATE', values, p.jobStatus) as Errs
          void values
          return (
            <>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format ?? errors.width ?? errors.height} />}</form.Field>}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

// ---------------------------------------------------------------------------
// REFILL_INK / INK_PAD
// ---------------------------------------------------------------------------

export function RefillInkForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'REFILL_INK', refillInkToChild)
  const form = useForm({
    defaultValues: { color: '', ink_type: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('REFILL_INK', values, p.jobStatus) as Errs
          void values
          return (
            <>
              <form.Field name="color">{f => <SelectField field={f} label="Colour" options={REFILL_COLOR_OPTS} error={errors.color} />}</form.Field>
              <form.Field name="ink_type">{f => <SelectField field={f} label="Ink type" options={INK_TYPE_OPTS} error={errors.ink_type} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export function InkPadForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'INK_PAD', inkPadToChild)
  const form = useForm({
    defaultValues: { pad_size: '', color: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('INK_PAD', values, p.jobStatus) as Errs
          void values
          return (
            <>
              <form.Field name="pad_size">{f => <SelectField field={f} label="Pad size" options={PAD_SIZE_OPTS} error={errors.pad_size} />}</form.Field>
              <form.Field name="color">{f => <SelectField field={f} label="Colour" options={REFILL_COLOR_OPTS} error={errors.color} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

// ---------------------------------------------------------------------------
// TRODAT_PAD — article number → cushion colour variants.
// ---------------------------------------------------------------------------

export function TrodatPadForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'TRODAT_PAD', trodatPadToChild)
  const form = useForm({
    defaultValues: { pad_article_number: '', pad_variant_id: '', color: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('TRODAT_PAD', values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="pad_article_number">{f => <TextField field={f} label="Article number" error={errors.pad_article_number} />}</form.Field>
              <form.Field name="pad_variant_id">{f => <CushionVariantSelect field={f} articleNumber={String(values.pad_article_number ?? '')} error={errors.pad_variant_id} />}</form.Field>
              <form.Field name="color">{f => <SelectField field={f} label="Colour" options={REFILL_COLOR_OPTS} error={errors.color} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}
