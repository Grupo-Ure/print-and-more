/** CopyShop department forms (7 types). */

import { useForm, type AnyFormApi } from '@tanstack/react-form'
import { validateProduct } from '../../../lib/products/registry'
import {
  posterToChild,
  cardFlyerToChild,
  foldedFlyerToChild,
  brochureToChild,
  businessCardToChild,
  bindingToChild,
  printoutToChild,
} from '../../../lib/products/schemas/copyshop'
import {
  POSTER_MATERIALIEN,
  CC_GRAMMATUREN,
  OFFSET_STANDARD_GRAMMATUREN,
  OFFSET_STANDARD_OBERFLAECHEN,
  OFFSET_OFFSET_GRAMMATUREN,
  OFFSET_SPEZIAL_PAPIERE,
  OFFSET_FOLIENKASCHIERUNG,
  OFFSET_FOLIENKASCHIERUNG_SEITEN,
  OFFSET_RECYCLING_GRAMMATUREN,
  VISITENKARTE_MATERIALIEN,
  MULTILOFT_FARBKERNE,
  BINDUNG_MATERIALIEN,
  AUSDRUCK_MATERIALIEN,
} from '../../../config/materialien'
import { CARD_DIN, FOLD_DIN, BROCHURE_DIN } from '../../../lib/copyshop/dinCfbFormats'
import { useProductSubmit, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { BooleanField, DimensionFields, FilePickerField, FormActions, QuantityField, SelectField, TextField, type Option } from './fields'

type Errs = Record<string, string>
type DinTable = Record<string, { b: number; h: number }>

const opts = (rows: readonly { wert: string; anzeige: string }[]): Option[] => rows.map(r => ({ value: r.wert, label: r.anzeige }))
const enumOpts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))

const POSTER_DIN: DinTable = { A4: { b: 210, h: 297 }, A3: { b: 297, h: 420 }, A2: { b: 420, h: 594 }, A1: { b: 594, h: 841 }, A0: { b: 841, h: 1189 } }

const PATH_OPTS = enumOpts([['CC', 'Copy Center'], ['OFFSET', 'Offset'], ['OFFEN', 'Open']])
const ORIENTATION_OPTS = enumOpts([['HOCHFORMAT', 'Portrait'], ['QUERFORMAT', 'Landscape']])
const LAMINATE_OPTS = enumOpts([['NEIN', 'None'], ['MATT', 'Matte'], ['GLAENZEND', 'Glossy']])
const CC_OPTS = opts(CC_GRAMMATUREN)
const CARD_FORMAT_OPTS = enumOpts([['DIN_LANG', 'DIN long'], ['A7', 'A7'], ['A6', 'A6'], ['A5', 'A5'], ['A4', 'A4'], ['A3', 'A3'], ['FREI', 'Free']])
const FOLD_FORMAT_OPTS = enumOpts([['DIN_LANG', 'DIN long'], ['A7', 'A7'], ['A6', 'A6'], ['A5', 'A5'], ['A4', 'A4'], ['FREI', 'Free']])
const COLOR_MODE_LABELS: Record<string, string> = { '1_0': '1/0', '1_1': '1/1', '4_0': '4/0', '4_1': '4/1', '4_4': '4/4' }
const cmOpts = (vals: string[]): Option[] => vals.map(v => ({ value: v, label: COLOR_MODE_LABELS[v] ?? v }))

// Material fields reset when the production path changes.
const CARD_FOLD_RESET = ['cc_material', 'cc_material_other', 'offset_type', 'offset_weight', 'offset_finish', 'special_paper', 'special_paper_other', 'lamination_finish', 'lamination_sides', 'recycling_weight']
const BROCHURE_RESET = [...CARD_FOLD_RESET, 'cover_material', 'cover_material_other', 'inner_material', 'inner_material_other', 'binding', 'cover_weight', 'cover_finish', 'inner_weight', 'inner_finish']

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

/** Auto-fill width/height from a DIN table when a non-FREI format is picked. */
function dinFill(form: AnyFormApi, table: DinTable) {
  return ({ value }: { value: unknown }) => {
    const f = String(value ?? '')
    if (f && f !== 'FREI' && table[f]) {
      form.setFieldValue('width', table[f].b)
      form.setFieldValue('height', table[f].h)
    }
  }
}

const resetKeys = (form: AnyFormApi, keys: string[]) => () => keys.forEach(k => form.setFieldValue(k, ''))

// ---------------------------------------------------------------------------
// POSTER
// ---------------------------------------------------------------------------

export function PosterForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'POSTER', posterToChild)
  const form = useForm({
    defaultValues: { format: '', material: '', laminate: '', width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('POSTER', values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="format" listeners={{ onChange: dinFill(form, POSTER_DIN) }}>{f => <SelectField field={f} label="Format" options={enumOpts([['A4', 'A4'], ['A3', 'A3'], ['A2', 'A2'], ['A1', 'A1'], ['A0', 'A0'], ['FREI', 'Free']])} error={errors.format} />}</form.Field>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={opts(POSTER_MATERIALIEN)} error={errors.material} />}</form.Field>
              <form.Field name="laminate">{f => <SelectField field={f} label="Laminate" options={LAMINATE_OPTS} error={errors.laminate} />}</form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format_masse} />}</form.Field>}</form.Field>
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
// CARD_FLYER / FOLDED_FLYER — shared body. The MaterialCC / MaterialOffset field
// groups are inline closures (they close over the typed `form`).
// ---------------------------------------------------------------------------

function CardFoldForm(p: ProductFormProps & { type: 'CARD_FLYER' | 'FOLDED_FLYER'; toChild: typeof cardFlyerToChild }) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, p.type, p.toChild)
  const isFold = p.type === 'FOLDED_FLYER'
  const form = useForm({
    defaultValues: {
      production_path: '', color_mode: '', fold_type: '', format: '', width: '', height: '', page_count: '', full_bleed: null, quantity: '',
      cc_material: '', cc_material_other: '', offset_type: '', offset_weight: '', offset_finish: '', special_paper: '', special_paper_other: '', recycling_weight: '', lamination_finish: '', lamination_sides: '',
      ...valuesFromProduct(p.product),
    } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct(p.type, values, p.jobStatus) as Errs
          const pp = values.production_path
          const cc = (matKey: string, otherKey: string, label: string) => (
            <>
              <form.Field name={matKey}>{f => <SelectField field={f} label={label} options={CC_OPTS} error={errors[matKey]} />}</form.Field>
              {values[matKey] === 'SONSTIGE' && <form.Field name={otherKey}>{f => <TextField field={f} label={`${label} (other)`} error={errors[otherKey]} />}</form.Field>}
            </>
          )
          const ot = values.offset_type
          const sp = values.special_paper
          const offset = (
            <>
              <form.Field name="offset_type">{f => <SelectField field={f} label="Offset type" options={enumOpts([['STANDARD', 'Standard'], ['OFFSET', 'Offset'], ['SPEZIAL', 'Special']])} error={errors.offset_type} />}</form.Field>
              {ot === 'STANDARD' && (
                <>
                  <form.Field name="offset_weight">{f => <SelectField field={f} label="Weight" options={opts(OFFSET_STANDARD_GRAMMATUREN)} error={errors.offset_weight} />}</form.Field>
                  <form.Field name="offset_finish">{f => <SelectField field={f} label="Finish" options={opts(OFFSET_STANDARD_OBERFLAECHEN)} error={errors.offset_finish} />}</form.Field>
                </>
              )}
              {ot === 'OFFSET' && <form.Field name="offset_weight">{f => <SelectField field={f} label="Weight" options={opts(OFFSET_OFFSET_GRAMMATUREN)} error={errors.offset_weight} />}</form.Field>}
              {ot === 'SPEZIAL' && (
                <>
                  <form.Field name="special_paper">{f => <SelectField field={f} label="Special paper" options={opts(OFFSET_SPEZIAL_PAPIERE)} error={errors.special_paper} />}</form.Field>
                  {sp === '300G_FOLIENKASCHIERT' && (
                    <>
                      <form.Field name="lamination_finish">{f => <SelectField field={f} label="Lamination finish" options={opts(OFFSET_FOLIENKASCHIERUNG)} error={errors.lamination_finish} />}</form.Field>
                      <form.Field name="lamination_sides">{f => <SelectField field={f} label="Lamination sides" options={opts(OFFSET_FOLIENKASCHIERUNG_SEITEN)} error={errors.lamination_sides} />}</form.Field>
                    </>
                  )}
                  {sp === 'RECYCLING' && <form.Field name="recycling_weight">{f => <SelectField field={f} label="Recycling weight" options={opts(OFFSET_RECYCLING_GRAMMATUREN)} error={errors.recycling_weight} />}</form.Field>}
                  {sp === 'SONSTIGE' && <form.Field name="special_paper_other">{f => <TextField field={f} label="Special paper (other)" error={errors.special_paper_other} />}</form.Field>}
                </>
              )}
            </>
          )
          return (
            <>
              <form.Field name="production_path" listeners={{ onChange: resetKeys(form, CARD_FOLD_RESET) }}>{f => <SelectField field={f} label="Production path" options={PATH_OPTS} error={errors.production_path} />}</form.Field>
              <form.Field name="color_mode">{f => <SelectField field={f} label="Colour mode" options={cmOpts(isFold ? ['1_1', '4_4'] : ['1_0', '1_1', '4_0', '4_4'])} error={errors.color_mode} />}</form.Field>
              {isFold && <form.Field name="fold_type">{f => <SelectField field={f} label="Fold type" options={enumOpts([['MITTELFALZ', 'Half fold'], ['WICKELFALZ', 'Roll fold'], ['ZICKZACK', 'Z-fold']])} error={errors.fold_type} />}</form.Field>}
              <form.Field name="format" listeners={{ onChange: dinFill(form, (isFold ? FOLD_DIN : CARD_DIN) as DinTable) }}>{f => <SelectField field={f} label="Format" options={isFold ? FOLD_FORMAT_OPTS : CARD_FORMAT_OPTS} error={errors.format} />}</form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format_masse} />}</form.Field>}</form.Field>
              {isFold && <form.Field name="page_count">{f => <TextField field={f} label="Page count" error={errors.page_count} />}</form.Field>}
              <form.Field name="full_bleed">{f => <BooleanField field={f} label="Full bleed" error={errors.full_bleed} />}</form.Field>
              {pp === 'CC' && cc('cc_material', 'cc_material_other', 'CC material')}
              {pp === 'OFFSET' && offset}
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

export const CardFlyerForm = (p: ProductFormProps) => <CardFoldForm {...p} type="CARD_FLYER" toChild={cardFlyerToChild} />
export const FoldedFlyerForm = (p: ProductFormProps) => <CardFoldForm {...p} type="FOLDED_FLYER" toChild={foldedFlyerToChild} />

// ---------------------------------------------------------------------------
// BROCHURE
// ---------------------------------------------------------------------------

export function BrochureForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'BROCHURE', brochureToChild)
  const form = useForm({
    defaultValues: {
      production_path: '', format: '', width: '', height: '', orientation: '', page_count: '', full_bleed: null, quantity: '',
      cover_material: '', cover_material_other: '', inner_material: '', inner_material_other: '', binding: '', cover_weight: '', cover_finish: '', inner_weight: '', inner_finish: '',
      ...valuesFromProduct(p.product),
    } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('BROCHURE', values, p.jobStatus) as Errs
          const pp = values.production_path
          const cc = (matKey: string, otherKey: string, label: string) => (
            <>
              <form.Field name={matKey}>{f => <SelectField field={f} label={label} options={CC_OPTS} error={errors[matKey]} />}</form.Field>
              {values[matKey] === 'SONSTIGE' && <form.Field name={otherKey}>{f => <TextField field={f} label={`${label} (other)`} error={errors[otherKey]} />}</form.Field>}
            </>
          )
          return (
            <>
              <form.Field name="production_path" listeners={{ onChange: resetKeys(form, BROCHURE_RESET) }}>{f => <SelectField field={f} label="Production path" options={PATH_OPTS} error={errors.production_path} />}</form.Field>
              <form.Field name="format" listeners={{ onChange: dinFill(form, BROCHURE_DIN as DinTable) }}>{f => <SelectField field={f} label="Format" options={enumOpts([['A6', 'A6'], ['A5', 'A5'], ['A4', 'A4'], ['FREI', 'Free']])} error={errors.format} />}</form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format_masse} />}</form.Field>}</form.Field>
              <form.Field name="orientation">{f => <SelectField field={f} label="Orientation" options={ORIENTATION_OPTS} error={errors.orientation ?? errors.brochure_landscape_cc} />}</form.Field>
              <form.Field name="page_count">{f => <TextField field={f} label="Page count" error={errors.page_count} />}</form.Field>
              <form.Field name="full_bleed">{f => <BooleanField field={f} label="Full bleed" error={errors.full_bleed} />}</form.Field>
              {pp === 'CC' && (
                <>
                  {cc('cover_material', 'cover_material_other', 'Cover material')}
                  {cc('inner_material', 'inner_material_other', 'Inner material')}
                </>
              )}
              {(pp === 'OFFSET' || pp === 'OFFEN') && (
                <>
                  <form.Field name="binding">{f => <SelectField field={f} label="Binding" options={enumOpts([['DRAHTHEFTUNG', 'Saddle stitch'], ['RINGSÖSEN', 'Ring eyelets'], ['KLEBEBINDUNG', 'Perfect binding'], ['SPIRALBINDUNG', 'Spiral']])} error={errors.binding} />}</form.Field>
                  <form.Field name="cover_weight">{f => <SelectField field={f} label="Cover weight" options={enumOpts([['135G', '135g'], ['170G', '170g'], ['250G', '250g'], ['300G', '300g']])} error={errors.cover_weight} />}</form.Field>
                  <form.Field name="cover_finish">{f => <SelectField field={f} label="Cover finish" options={enumOpts([['MATT', 'Matte'], ['GLAENZEND', 'Glossy']])} error={errors.cover_finish} />}</form.Field>
                  <form.Field name="inner_weight">{f => <SelectField field={f} label="Inner weight" options={enumOpts([['90G', '90g'], ['135G', '135g'], ['170G', '170g']])} error={errors.inner_weight} />}</form.Field>
                  <form.Field name="inner_finish">{f => <SelectField field={f} label="Inner finish" options={enumOpts([['MATT', 'Matte'], ['GLAENZEND', 'Glossy']])} error={errors.inner_finish} />}</form.Field>
                </>
              )}
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
// BUSINESS_CARD
// ---------------------------------------------------------------------------

export function BusinessCardForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'BUSINESS_CARD', businessCardToChild)
  const form = useForm({
    defaultValues: { material: '', color_mode: '', format: '', width: '', height: '', orientation: '', film_laminated: null, multiloft_color: '', full_bleed: null, quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('BUSINESS_CARD', values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={opts(VISITENKARTE_MATERIALIEN)} error={errors.material} />}</form.Field>
              <form.Field name="color_mode">{f => <SelectField field={f} label="Colour mode" options={cmOpts(['4_0', '4_4'])} error={errors.color_mode} />}</form.Field>
              <form.Field name="format">{f => <SelectField field={f} label="Format" options={enumOpts([['STANDARD_85_55', '85×55 mm'], ['STANDARD_90_50', '90×50 mm'], ['FREI', 'Free']])} error={errors.format} />}</form.Field>
              {values.format === 'FREI' && <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format_masse} />}</form.Field>}</form.Field>}
              <form.Field name="orientation">{f => <SelectField field={f} label="Orientation" options={ORIENTATION_OPTS} error={errors.orientation} />}</form.Field>
              {values.material === '350G_OFFSET' && <form.Field name="film_laminated">{f => <BooleanField field={f} label="Film laminated" error={errors.film_laminated} />}</form.Field>}
              {values.material === 'MULTILOFT' && <form.Field name="multiloft_color">{f => <SelectField field={f} label="Multiloft core" options={opts(MULTILOFT_FARBKERNE)} error={errors.multiloft_color} />}</form.Field>}
              <form.Field name="full_bleed">{f => <BooleanField field={f} label="Full bleed" error={errors.full_bleed} />}</form.Field>
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
// BINDING
// ---------------------------------------------------------------------------

const BINDING_COLOR_SETS: Record<string, [string, string][]> = {
  WIRE_O: [['SCHWARZ', 'Black'], ['SILBER', 'Silver']],
  KUNSTSTOFFSPIRALE: [['SCHWARZ', 'Black'], ['WEISS', 'White']],
  SOFTCOVER: [['SCHWARZ', 'Black'], ['DUNKELBLAU', 'Dark blue'], ['DUNKELROT', 'Dark red']],
  HARDCOVER: [['SCHWARZ', 'Black'], ['DUNKELBLAU', 'Dark blue'], ['DUNKELROT', 'Dark red']],
}

export function BindingForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'BINDING', bindingToChild)
  const form = useForm({
    defaultValues: { material: '', material_other: '', color_mode: '', binding_type: '', binding_color: '', format: '', orientation: '', width: '', height: '', hardcover_print: null, hardcover_cover: '', full_bleed: null, quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('BINDING', values, p.jobStatus) as Errs
          const bt = String(values.binding_type ?? '')
          const isWire = bt === 'WIRE_O' || bt === 'KUNSTSTOFFSPIRALE'
          const isCover = bt === 'SOFTCOVER' || bt === 'HARDCOVER'
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={opts(BINDUNG_MATERIALIEN)} error={errors.material} />}</form.Field>
              {values.material === 'SONSTIGE' && <form.Field name="material_other">{f => <TextField field={f} label="Material (other)" error={errors.material_other} />}</form.Field>}
              <form.Field name="color_mode">{f => <SelectField field={f} label="Colour mode" options={cmOpts(['1_0', '1_1', '4_0', '4_1'])} error={errors.color_mode} />}</form.Field>
              <form.Field name="binding_type">{f => <SelectField field={f} label="Binding type" options={enumOpts([['WIRE_O', 'Wire-O'], ['KUNSTSTOFFSPIRALE', 'Plastic spiral'], ['SOFTCOVER', 'Softcover'], ['HARDCOVER', 'Hardcover']])} error={errors.binding_type} />}</form.Field>
              <form.Field name="binding_color">{f => <SelectField field={f} label="Binding colour" options={enumOpts(BINDING_COLOR_SETS[bt] ?? [])} error={errors.binding_color} />}</form.Field>
              {isWire && (
                <>
                  <form.Field name="format">{f => <SelectField field={f} label="Format" options={enumOpts([['A5', 'A5'], ['A4', 'A4'], ['A3', 'A3'], ['FREI', 'Free']])} error={errors.format} />}</form.Field>
                  <form.Field name="orientation">{f => <SelectField field={f} label="Orientation" options={ORIENTATION_OPTS} error={errors.orientation} />}</form.Field>
                  {values.format === 'FREI' && <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>}
                </>
              )}
              {isCover && (
                <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
              )}
              {bt === 'HARDCOVER' && (
                <>
                  <form.Field name="hardcover_print">{f => <BooleanField field={f} label="Hardcover print" error={errors.hardcover_print} />}</form.Field>
                  {values.hardcover_print === true && <form.Field name="hardcover_cover">{f => <TextField field={f} label="Hardcover cover" error={errors.hardcover_cover} />}</form.Field>}
                </>
              )}
              <form.Field name="full_bleed">{f => <BooleanField field={f} label="Full bleed" error={errors.full_bleed} />}</form.Field>
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
// PRINTOUT
// ---------------------------------------------------------------------------

export function PrintoutForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'PRINTOUT', printoutToChild)
  const form = useForm({
    defaultValues: { format: '', material: '', material_other: '', color_mode: '', punching: '', staple: null, laminate: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('PRINTOUT', values, p.jobStatus) as Errs
          return (
            <>
              <form.Field name="format">{f => <SelectField field={f} label="Format" options={enumOpts([['A5', 'A5'], ['A4', 'A4'], ['A3', 'A3']])} error={errors.format} />}</form.Field>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={opts(AUSDRUCK_MATERIALIEN)} error={errors.material} />}</form.Field>
              {values.material === 'SONSTIGE' && <form.Field name="material_other">{f => <TextField field={f} label="Material (other)" error={errors.material_other} />}</form.Field>}
              <form.Field name="color_mode">{f => <SelectField field={f} label="Colour mode" options={cmOpts(['1_0', '1_1', '4_0', '4_1'])} error={errors.color_mode} />}</form.Field>
              <form.Field name="punching">{f => <SelectField field={f} label="Punching" options={enumOpts([['NEIN', 'None'], ['2_LOCH', '2-hole'], ['4_LOCH', '4-hole']])} error={errors.punching} />}</form.Field>
              <form.Field name="staple">{f => <BooleanField field={f} label="Staple" error={errors.staple} />}</form.Field>
              <form.Field name="laminate">{f => <SelectField field={f} label="Laminate" options={LAMINATE_OPTS} error={errors.laminate} />}</form.Field>
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
