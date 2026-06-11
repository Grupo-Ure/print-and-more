/** Laser-engraving department forms (5 types). */

import { useForm } from '@tanstack/react-form'
import { validateProduct } from '../../../lib/products/registry'
import {
  signToChild,
  trophyPlateToChild,
  nameTagToChild,
  giftItemToChild,
  otherLaserToChild,
} from '../../../lib/products/schemas/laser'
import { LASER_SIGN_MATERIALS, LASER_SIGN_MATERIAL_LABELS, LASER_ORIGINS, LASER_ORIGIN_LABELS } from '../../../types/laser'
import type { ProductChildInsert } from '../../../types/product'
import { useProductSubmit, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { BooleanField, DimensionFields, FilePickerField, FormActions, QuantityField, SelectField, TextField, type Option } from './fields'

const MATERIAL_OPTIONS: Option[] = LASER_SIGN_MATERIALS.map(m => ({ value: m, label: LASER_SIGN_MATERIAL_LABELS[m] }))
const ORIGIN_OPTIONS: Option[] = LASER_ORIGINS.map(o => ({ value: o, label: LASER_ORIGIN_LABELS[o] }))

// ---------------------------------------------------------------------------
// SIGN / TROPHY_PLATE / NAME_TAG — shared sign body.
// ---------------------------------------------------------------------------

function SignLikeForm(p: ProductFormProps & { type: string; toChild: (v: FormValues) => ProductChildInsert; withSelfAdhesive: boolean }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, p.type, p.toChild)
  const form = useForm({
    defaultValues: { material: '', material_other: '', width: '', height: '', round_corners: null, self_adhesive: null, motif: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit() }} className="flex flex-col gap-3">
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct(p.type, values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={MATERIAL_OPTIONS} error={errors.material} />}</form.Field>
              {values.material === 'SONSTIGE' && (
                <form.Field name="material_other">{f => <TextField field={f} label="Material (other)" error={errors.material_other} />}</form.Field>
              )}
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
              <form.Field name="round_corners">{f => <BooleanField field={f} label="Round corners" error={errors.round_corners} />}</form.Field>
              {p.withSelfAdhesive && (
                <form.Field name="self_adhesive">{f => <BooleanField field={f} label="Self-adhesive" error={errors.self_adhesive} />}</form.Field>
              )}
              <form.Field name="motif">{f => <TextField field={f} label="Motif" error={errors.motif} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

export const SignForm = (p: ProductFormProps) => <SignLikeForm {...p} type="SIGN" toChild={signToChild} withSelfAdhesive />
export const TrophyPlateForm = (p: ProductFormProps) => <SignLikeForm {...p} type="TROPHY_PLATE" toChild={trophyPlateToChild} withSelfAdhesive />
export const NameTagForm = (p: ProductFormProps) => <SignLikeForm {...p} type="NAME_TAG" toChild={nameTagToChild} withSelfAdhesive={false} />

// ---------------------------------------------------------------------------
// GIFT_ITEM
// ---------------------------------------------------------------------------

export function GiftItemForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'GIFT_ITEM', giftItemToChild)
  const form = useForm({
    defaultValues: { material_free_text: '', origin: '', motif: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit() }} className="flex flex-col gap-3">
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('GIFT_ITEM', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material_free_text">{f => <TextField field={f} label="Material" error={errors.material_free_text} />}</form.Field>
              <form.Field name="origin">{f => <SelectField field={f} label="Origin" options={ORIGIN_OPTIONS} error={errors.origin} />}</form.Field>
              <form.Field name="motif">{f => <TextField field={f} label="Motif" error={errors.motif} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

// ---------------------------------------------------------------------------
// OTHER_LASER
// ---------------------------------------------------------------------------

export function OtherLaserForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'OTHER_LASER', otherLaserToChild)
  const form = useForm({
    defaultValues: { self_adhesive: null, origin: '', motif: '', material_free_text: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit() }} className="flex flex-col gap-3">
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('OTHER_LASER', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material_free_text">{f => <TextField field={f} label="Material (optional)" error={errors.material_free_text} />}</form.Field>
              <form.Field name="self_adhesive">{f => <BooleanField field={f} label="Self-adhesive" error={errors.self_adhesive} />}</form.Field>
              <form.Field name="origin">{f => <SelectField field={f} label="Origin" options={ORIGIN_OPTIONS} error={errors.origin} />}</form.Field>
              <form.Field name="motif">{f => <TextField field={f} label="Motif" error={errors.motif} />}</form.Field>
              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>
              <FilePickerField value={fileIds} onChange={setFileIds} orderFiles={p.orderFiles} />
              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={submitting} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
