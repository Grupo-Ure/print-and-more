/** LFP (large-format print) department forms (8 types). */

import { useForm } from '@tanstack/react-form'
import { validateProduct } from '../../../lib/products/registry'
import {
  stickerToChild,
  signUvToChild,
  signFoilToChild,
  foilPlotterToChild,
  bannerToChild,
  rollupToChild,
  vehicleLetteringToChild,
  otherLfpToChild,
} from '../../../lib/products/schemas/lfp'
import { LFP_AUFKLEBER_MATERIALIEN, LFP_3551_VARIANTEN, LFP_FOLIENPLOTT_MATERIALIEN } from '../../../config/materialien'
import { useProductSubmit, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import {
  BooleanField,
  DateField,
  DimensionFields,
  FilePickerField,
  FormActions,
  QuantityField,
  SelectField,
  TextareaField,
  TextField,
  type Option,
} from './fields'

const opts = (rows: readonly { wert: string; anzeige: string }[]): Option[] => rows.map(r => ({ value: r.wert, label: r.anzeige }))

const STICKER_MATERIAL_OPTS = opts(LFP_AUFKLEBER_MATERIALIEN)
const VARIANT_OPTS: Option[] = LFP_3551_VARIANTEN.filter(v => v.wert != null).map(v => ({ value: v.wert as string, label: v.anzeige }))
const FOIL_PLOTTER_MATERIAL_OPTS = opts(LFP_FOLIENPLOTT_MATERIALIEN)
const CONTOUR_OPTS: Option[] = [{ value: 'FREIFORM', label: 'Freeform' }, { value: 'RECHTECK', label: 'Rectangle' }]
const LAMINATE_OPTS: Option[] = [{ value: 'NEIN', label: 'None' }, { value: 'MATT', label: 'Matte' }, { value: 'GLAENZEND', label: 'Glossy' }]
const OUTPUT_OPTS: Option[] = [{ value: 'EINZEL', label: 'Individual' }, { value: 'BOGEN', label: 'Sheet' }]
const BOARD_MATERIAL_OPTS: Option[] = [{ value: 'ALUVERBUND', label: 'Alu-Composite' }, { value: 'PVC', label: 'PVC' }, { value: 'ACRYLGLAS', label: 'Acrylic glass' }]
const PRINT_SIDE_OPTS: Option[] = [{ value: 'EINSEITIG', label: 'Single-sided' }, { value: 'BEIDSEITIG', label: 'Double-sided' }]
const ACRYLIC_DIR_OPTS: Option[] = [{ value: 'VORDERSEITE', label: 'Front' }, { value: 'RUECKSEITE', label: 'Back' }]
const BANNER_MATERIAL_OPTS: Option[] = [{ value: 'PVC_FRONTLIT', label: 'PVC Frontlit' }, { value: 'MESH', label: 'Mesh' }, { value: 'BAUZAUNBANNER', label: 'Fence banner' }]
const ROLLUP_MATERIAL_OPTS: Option[] = [{ value: 'PVC_FRONTLIT', label: 'PVC Frontlit' }, { value: 'ROLLUP_FILM', label: 'Roll-up film' }]
const ROLLUP_SYSTEM_OPTS: Option[] = [{ value: 'NEUE_KASSETTE', label: 'New cassette' }, { value: 'MOTIVTAUSCH', label: 'Motif swap' }]
const ROLLUP_WIDTH_OPTS: Option[] = [{ value: '85', label: '85 cm' }, { value: '100', label: '100 cm' }]
const INSTALLATION_OPTS: Option[] = [{ value: 'MIT', label: 'With installation' }, { value: 'OHNE', label: 'Without' }]

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

// ---------------------------------------------------------------------------
// STICKER
// ---------------------------------------------------------------------------

export function StickerForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'STICKER', stickerToChild)
  const form = useForm({
    defaultValues: { material: '', material_variant: '', contour_cut: '', laminate: '', output: '', width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('STICKER', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={STICKER_MATERIAL_OPTS} error={errors.material} />}</form.Field>
              {values.material === '3551' && (
                <form.Field name="material_variant">{f => <SelectField field={f} label="3551 variant" options={VARIANT_OPTS} error={errors.material_variant} />}</form.Field>
              )}
              <form.Field name="contour_cut">{f => <SelectField field={f} label="Contour cut" options={CONTOUR_OPTS} error={errors.contour_cut} />}</form.Field>
              <form.Field name="laminate">{f => <SelectField field={f} label="Laminate" options={LAMINATE_OPTS} error={errors.laminate} />}</form.Field>
              <form.Field name="output">{f => <SelectField field={f} label="Output" options={OUTPUT_OPTS} error={errors.output} />}</form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
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
// SIGN_UV
// ---------------------------------------------------------------------------

export function SignUvForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'SIGN_UV', signUvToChild)
  const form = useForm({
    defaultValues: { material: '', print_side: '', acrylic_print_direction: '', round_corners: null, drill_holes: null, drill_hole_diameter: '', drill_hole_position: '', width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('SIGN_UV', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={BOARD_MATERIAL_OPTS} error={errors.material} />}</form.Field>
              <form.Field name="print_side">{f => <SelectField field={f} label="Print side" options={PRINT_SIDE_OPTS} error={errors.print_side} />}</form.Field>
              {values.material === 'ACRYLGLAS' && (
                <form.Field name="acrylic_print_direction">{f => <SelectField field={f} label="Acrylic print direction" options={ACRYLIC_DIR_OPTS} error={errors.acrylic_print_direction} />}</form.Field>
              )}
              <form.Field name="round_corners">{f => <BooleanField field={f} label="Round corners" error={errors.round_corners} />}</form.Field>
              <form.Field name="drill_holes">{f => <BooleanField field={f} label="Drill holes" error={errors.drill_holes} />}</form.Field>
              {values.drill_holes === true && (
                <>
                  <form.Field name="drill_hole_diameter">{f => <TextField field={f} label="Drill hole diameter (mm)" error={errors.drill_hole_diameter} />}</form.Field>
                  <form.Field name="drill_hole_position">{f => <TextField field={f} label="Drill hole position" error={errors.drill_hole_position} />}</form.Field>
                </>
              )}
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
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
// SIGN_FOIL
// ---------------------------------------------------------------------------

export function SignFoilForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'SIGN_FOIL', signFoilToChild)
  const form = useForm({
    defaultValues: { material: '', print_side: '', laminate: '', round_corners: null, drill_holes: null, drill_hole_diameter: '', drill_hole_position: '', width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('SIGN_FOIL', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={BOARD_MATERIAL_OPTS} error={errors.material} />}</form.Field>
              <form.Field name="print_side">{f => <SelectField field={f} label="Print side" options={PRINT_SIDE_OPTS} error={errors.print_side} />}</form.Field>
              <form.Field name="laminate">{f => <SelectField field={f} label="Laminate" options={LAMINATE_OPTS} error={errors.laminate} />}</form.Field>
              <form.Field name="round_corners">{f => <BooleanField field={f} label="Round corners" error={errors.round_corners} />}</form.Field>
              <form.Field name="drill_holes">{f => <BooleanField field={f} label="Drill holes" error={errors.drill_holes} />}</form.Field>
              {values.drill_holes === true && (
                <>
                  <form.Field name="drill_hole_diameter">{f => <TextField field={f} label="Drill hole diameter (mm)" error={errors.drill_hole_diameter} />}</form.Field>
                  <form.Field name="drill_hole_position">{f => <TextField field={f} label="Drill hole position" error={errors.drill_hole_position} />}</form.Field>
                </>
              )}
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
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
// FOIL_PLOTTER
// ---------------------------------------------------------------------------

export function FoilPlotterForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'FOIL_PLOTTER', foilPlotterToChild)
  const form = useForm({
    defaultValues: { material: '', output: '', width: '', height: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('FOIL_PLOTTER', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={FOIL_PLOTTER_MATERIAL_OPTS} error={errors.material} />}</form.Field>
              <form.Field name="output">{f => <SelectField field={f} label="Output" options={OUTPUT_OPTS} error={errors.output} />}</form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
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
// BANNER — material BAUZAUNBANNER auto-fills width/height/hem/eyelets.
// ---------------------------------------------------------------------------

export function BannerForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'BANNER', bannerToChild)
  const form = useForm({
    defaultValues: { material: '', width: '', height: '', hem: null, hem_sides: '', eyelets: null, eyelet_detail: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('BANNER', values, p.subOrderStatus)
          return (
            <>
              <form.Field
                name="material"
                listeners={{
                  onChange: ({ value }) => {
                    if (value === 'BAUZAUNBANNER') {
                      form.setFieldValue('width', '3400')
                      form.setFieldValue('height', '1730')
                      form.setFieldValue('hem', true)
                      form.setFieldValue('eyelets', true)
                    }
                  },
                }}
              >
                {f => <SelectField field={f} label="Material" options={BANNER_MATERIAL_OPTS} error={errors.material} />}
              </form.Field>
              <form.Field name="width">{wf => <form.Field name="height">{hf => <DimensionFields widthField={wf} heightField={hf} formatError={errors.format} />}</form.Field>}</form.Field>
              <form.Field name="hem">{f => <BooleanField field={f} label="Hem" error={errors.hem} />}</form.Field>
              {values.hem === true && (
                <form.Field name="hem_sides">{f => <TextField field={f} label="Hem sides" error={errors.hem_sides} />}</form.Field>
              )}
              <form.Field name="eyelets">{f => <BooleanField field={f} label="Eyelets" error={errors.eyelets} />}</form.Field>
              {values.eyelets === true && (
                <form.Field name="eyelet_detail">{f => <TextField field={f} label="Eyelet detail" error={errors.eyelet_detail} />}</form.Field>
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
// ROLLUP
// ---------------------------------------------------------------------------

export function RollupForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'ROLLUP', rollupToChild)
  const form = useForm({
    defaultValues: { material: '', rollup_system: '', rollup_width: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('ROLLUP', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="material">{f => <SelectField field={f} label="Material" options={ROLLUP_MATERIAL_OPTS} error={errors.material} />}</form.Field>
              <form.Field name="rollup_system">{f => <SelectField field={f} label="System" options={ROLLUP_SYSTEM_OPTS} error={errors.rollup_system} />}</form.Field>
              <form.Field name="rollup_width">{f => <SelectField field={f} label="Width" options={ROLLUP_WIDTH_OPTS} error={errors.rollup_width} />}</form.Field>
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
// VEHICLE_LETTERING — installation MIT reveals existing_wrap + date.
// ---------------------------------------------------------------------------

export function VehicleLetteringForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'VEHICLE_LETTERING', vehicleLetteringToChild)
  const form = useForm({
    defaultValues: { vehicle_make: '', vehicle_model: '', area_sides: null, area_front: null, area_rear: null, installation: '', existing_wrap: null, installation_date: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('VEHICLE_LETTERING', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="vehicle_make">{f => <TextField field={f} label="Vehicle make" error={errors.vehicle_make} />}</form.Field>
              <form.Field name="vehicle_model">{f => <TextField field={f} label="Vehicle model" error={errors.vehicle_model} />}</form.Field>
              <form.Field name="area_sides">{f => <BooleanField field={f} label="Sides" error={errors.area_sides} />}</form.Field>
              <form.Field name="area_front">{f => <BooleanField field={f} label="Front" error={errors.area_front} />}</form.Field>
              <form.Field name="area_rear">{f => <BooleanField field={f} label="Rear" error={errors.area_rear} />}</form.Field>
              <form.Field name="installation">{f => <SelectField field={f} label="Installation" options={INSTALLATION_OPTS} error={errors.installation} />}</form.Field>
              {values.installation === 'MIT' && (
                <>
                  <form.Field name="existing_wrap">{f => <BooleanField field={f} label="Existing wrap" error={errors.existing_wrap} />}</form.Field>
                  <form.Field name="installation_date">{f => <DateField field={f} label="Installation date" error={errors.installation_date} />}</form.Field>
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
// OTHER_LFP
// ---------------------------------------------------------------------------

export function OtherLfpForm(p: ProductFormProps) {
  const { fileIds, setFileIds, submit, submitting } = useProductSubmit(p, 'OTHER_LFP', otherLfpToChild)
  const form = useForm({
    defaultValues: { description: '', quantity: '', ...valuesFromProduct(p.product) } as FormValues,
    onSubmit: ({ value }) => submit(value),
  })
  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('OTHER_LFP', values, p.subOrderStatus)
          return (
            <>
              <form.Field name="description">{f => <TextareaField field={f} label="Description" error={errors.description} />}</form.Field>
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
