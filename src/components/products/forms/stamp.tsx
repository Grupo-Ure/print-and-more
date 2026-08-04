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
import { STAMP_COLORS, REFILL_INK_COLORS, STAMP_COLOR_LABELS } from '../../../types/stamp'
import { stampService } from '../../../services/stampService'
import { useProductSubmit, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { DimensionFields, FilePickerField, FormActions, QuantityField, SelectField, TextareaField, TextField, type Option } from './fields'

type FieldErrors = Record<string, string>

const CLASSIC_COLOR_OPTIONS: Option[] = STAMP_COLORS.map(colorCode => ({ value: colorCode, label: STAMP_COLOR_LABELS[colorCode] }))
const REFILL_COLOR_OPTIONS: Option[] = REFILL_INK_COLORS.map(colorCode => ({ value: colorCode, label: STAMP_COLOR_LABELS[colorCode] }))
const INK_TYPE_OPTIONS: Option[] = [{ value: 'NORMAL', label: 'Normal' }, { value: 'HAUTVERTRAEGLICH', label: 'Skin-friendly' }, { value: 'TEXTIL', label: 'Textile' }]
const PAD_SIZE_OPTIONS: Option[] = [{ value: 'SMALL', label: 'Small' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LARGE', label: 'Large' }]

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

/** Async model picker for TRODAT_PRINTY / WOODEN_STAMP (binds `model_id`). */
function ModelSelect({ field, type, error }: { field: AnyFieldApi; type: string; error?: string }) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let alive = true
    stampService.getStampModelsByType(type).then(rows => { if (alive) setModels(rows.map(row => ({ id: row.id, name: row.name }))) }).catch(() => {})
    return () => { alive = false }
  }, [type])
  return <SelectField field={field} label="Stamp model" options={models.map(model => ({ value: model.id, label: model.name }))} error={error} placeholder="Select a model…" />
}

/** Async cushion-variant picker for TRODAT_PAD (binds `pad_variant_id`). */
function CushionVariantSelect({ field, articleNumber, error }: { field: AnyFieldApi; articleNumber: string; error?: string }) {
  const [cushions, setCushions] = useState<{ id: string; color: string | null; stock: number | null }[]>([])
  useEffect(() => {
    if (!articleNumber) return
    let alive = true
    stampService.getCushionsByArticleNumber(articleNumber).then(rows => { if (alive) setCushions(rows.map(row => ({ id: row.id, color: row.color, stock: row.stock }))) }).catch(() => {})
    return () => { alive = false }
  }, [articleNumber])
  const options = articleNumber ? cushions.map(cushion => ({ value: cushion.id, label: `${cushion.color ?? '—'} (stock ${cushion.stock ?? 0})` })) : []
  return <SelectField field={field} label="Colour variant" options={options} error={error} />
}

// ---------------------------------------------------------------------------
// TRODAT_PRINTY / WOODEN_STAMP — model_id + classic color/description.
// ---------------------------------------------------------------------------

function ModelStampForm(props: ProductFormProps & { type: 'TRODAT_PRINTY' | 'WOODEN_STAMP' }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, props.type, modelStampToChild)
  const form = useForm({
    defaultValues: { model_id: '', color: '', color_other: '', description: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct(props.type, values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="model_id">{field => <ModelSelect field={field} type={props.type} error={errors.model_id} />}</form.Field>
              <form.Field name="color">{field => <SelectField field={field} label="Colour" options={CLASSIC_COLOR_OPTIONS} error={errors.color} />}</form.Field>
              {values.color === 'OTHER' && <form.Field name="color_other">{field => <TextField field={field} label="Colour (other)" error={errors.color_other} />}</form.Field>}
              <form.Field name="description">{field => <TextareaField field={field} label="Description" rows={3} error={errors.description} />}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export const TrodatPrintyForm = (props: ProductFormProps) => <ModelStampForm {...props} type="TRODAT_PRINTY" />
export const WoodenStampForm = (props: ProductFormProps) => <ModelStampForm {...props} type="WOODEN_STAMP" />

// ---------------------------------------------------------------------------
// STAND_STAMP / DATE_STAMP / OTHER_STAMP — dimensions + classic color/description.
// ---------------------------------------------------------------------------

function ClassicStampForm(props: ProductFormProps & { type: 'STAND_STAMP' | 'DATE_STAMP' | 'OTHER_STAMP' }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, props.type, classicStampToChild)
  const form = useForm({
    defaultValues: { width: '', height: '', color: '', color_other: '', description: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct(props.type, values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="width">{widthField => <form.Field name="height">{heightField => <DimensionFields widthField={widthField} heightField={heightField} formatError={errors.format ?? errors.width ?? errors.height} />}</form.Field>}</form.Field>
              <form.Field name="color">{field => <SelectField field={field} label="Colour" options={CLASSIC_COLOR_OPTIONS} error={errors.color} />}</form.Field>
              {values.color === 'OTHER' && <form.Field name="color_other">{field => <TextField field={field} label="Colour (other)" error={errors.color_other} />}</form.Field>}
              <form.Field name="description">{field => <TextareaField field={field} label="Description" rows={3} error={errors.description} />}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export const StandStampForm = (props: ProductFormProps) => <ClassicStampForm {...props} type="STAND_STAMP" />
export const DateStampForm = (props: ProductFormProps) => <ClassicStampForm {...props} type="DATE_STAMP" />
export const OtherStampForm = (props: ProductFormProps) => <ClassicStampForm {...props} type="OTHER_STAMP" />

// ---------------------------------------------------------------------------
// STAMP_PLATE
// ---------------------------------------------------------------------------

export function StampPlateForm(props: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, 'STAMP_PLATE', stampPlateToChild)
  const form = useForm({
    defaultValues: { width: '', height: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct('STAMP_PLATE', values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="width">{widthField => <form.Field name="height">{heightField => <DimensionFields widthField={widthField} heightField={heightField} formatError={errors.format ?? errors.width ?? errors.height} />}</form.Field>}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
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

export function RefillInkForm(props: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, 'REFILL_INK', refillInkToChild)
  const form = useForm({
    defaultValues: { color: '', ink_type: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct('REFILL_INK', values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="color">{field => <SelectField field={field} label="Colour" options={REFILL_COLOR_OPTIONS} error={errors.color} />}</form.Field>
              <form.Field name="ink_type">{field => <SelectField field={field} label="Ink type" options={INK_TYPE_OPTIONS} error={errors.ink_type} />}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}

export function InkPadForm(props: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, 'INK_PAD', inkPadToChild)
  const form = useForm({
    defaultValues: { pad_size: '', color: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct('INK_PAD', values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="pad_size">{field => <SelectField field={field} label="Pad size" options={PAD_SIZE_OPTIONS} error={errors.pad_size} />}</form.Field>
              <form.Field name="color">{field => <SelectField field={field} label="Colour" options={REFILL_COLOR_OPTIONS} error={errors.color} />}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
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

export function TrodatPadForm(props: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(props, 'TRODAT_PAD', trodatPadToChild)
  const form = useForm({
    defaultValues: { pad_article_number: '', pad_variant_id: '', color: '', quantity: '', ...valuesFromProduct(props.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct('TRODAT_PAD', values, props.orderIsQuote) as FieldErrors
          return (
            <>
              <form.Field name="pad_article_number">{field => <TextField field={field} label="Article number" error={errors.pad_article_number} />}</form.Field>
              <form.Field name="pad_variant_id">{field => <CushionVariantSelect field={field} articleNumber={String(values.pad_article_number ?? '')} error={errors.pad_variant_id} />}</form.Field>
              <form.Field name="color">{field => <SelectField field={field} label="Colour" options={REFILL_COLOR_OPTIONS} error={errors.color} />}</form.Field>
              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={props.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!props.product} onCancel={props.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}
