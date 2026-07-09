/**
 * Textile garment form (the single TEXTILE_GARMENT type).
 *
 * The garment spine (origin → catalog variant / free-text / customer stock) is a
 * normal product child. The design applications (`links`) are held in local
 * state like `fileIds` and reconciled by `useSaveProduct`; they're folded into
 * the values passed to `validateProduct` so the schema gates "≥ 1 design".
 */

import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { validateProduct } from '../../../lib/products/registry'
import { qtyOut } from '../../../lib/products/schemas/_shared'
import { textileGarmentToChild } from '../../../lib/products/schemas/textile'
import { useSaveProduct } from '../../../queries/productQueries'
import { textileService } from '../../../services/textileService'
import { textileMasterDataService } from '../../../services/textileMasterDataService'
import type { TextileMotifRow, TextileMotifLinkInput } from '../../../types/textile'
import { useToast } from '../../Toast'
import { Button } from '../../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { buildWriteInput, valuesFromProduct, type FormValues, type ProductFormProps } from './shared'
import { FieldRow, FormActions, QuantityField, SelectField, TextField, type Option } from './fields'
import { motifLabel } from './textileTypes'

type Errs = Record<string, string>

/** Garment form needs the job's designs (for the link picker) and the
 *  edited product's existing links (for prefill). */
export type TextileGarmentFormProps = ProductFormProps & {
  motifs: TextileMotifRow[]
  initialLinks: TextileMotifLinkInput[]
}

const ORIGIN_OPTS: Option[] = [
  { value: 'OWN_STOCK', label: 'In-house stock' },
  { value: 'CUSTOMER_STOCK', label: 'Customer-supplied' },
]
const GARMENT_TYPE_OPTS: Option[] = [
  { value: 'T_SHIRT', label: 'T-Shirt' },
  { value: 'POLO', label: 'Polo' },
  { value: 'SWEATSHIRT', label: 'Sweatshirt' },
  { value: 'HOODIE', label: 'Hoodie' },
  { value: 'ZIP_HOODIE', label: 'Zip Hoodie' },
  { value: 'JACKE', label: 'Jacket' },
  { value: 'SONSTIGES', label: 'Other' },
]
const PLACEMENT_OPTS: Option[] = [
  { value: 'BRUST_LINKS', label: 'Chest left' },
  { value: 'BRUST_MITTE', label: 'Chest centre' },
  { value: 'BRUST_RECHTS', label: 'Chest right' },
  { value: 'RUECKEN', label: 'Back' },
  { value: 'ARM_LINKS', label: 'Sleeve left' },
  { value: 'ARM_RECHTS', label: 'Sleeve right' },
  { value: 'SONSTIGE', label: 'Other' },
]
const APP_SIZE_OPTS: Option[] = [
  { value: 'KLEIN', label: 'Small' },
  { value: 'MITTEL', label: 'Medium' },
  { value: 'GROSS', label: 'Large' },
  { value: 'FREI', label: 'Custom' },
]

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

// --- Design-link editor -----------------------------------------------------

function DesignLinksEditor({
  links,
  motifs,
  error,
  onChange,
}: {
  links: TextileMotifLinkInput[]
  motifs: TextileMotifRow[]
  error?: string
  onChange: (next: TextileMotifLinkInput[]) => void
}) {
  const set = (i: number, patch: Partial<TextileMotifLinkInput>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i))
  const add = () => onChange([...links, { motif_id: '', placement: '', size: '', print_method: null }])

  return (
    <FieldRow label="Designs applied" error={error}>
      <div className="flex flex-col gap-2">
        {links.length === 0 && <p className="text-xs text-muted-foreground">No designs applied yet.</p>}
        {links.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <Select value={l.motif_id || undefined} onValueChange={v => set(i, { motif_id: v })}>
              <SelectTrigger size="sm" className="w-44"><SelectValue placeholder="Design…" /></SelectTrigger>
              <SelectContent>
                {motifs.map(m => <SelectItem key={m.id} value={m.id}>{motifLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={l.placement || undefined} onValueChange={v => set(i, { placement: v })}>
              <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Placement…" /></SelectTrigger>
              <SelectContent>
                {PLACEMENT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={l.size || undefined} onValueChange={v => set(i, { size: v })}>
              <SelectTrigger size="sm" className="w-28"><SelectValue placeholder="Size…" /></SelectTrigger>
              <SelectContent>
                {APP_SIZE_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <button type="button" className="cursor-pointer text-muted-foreground hover:text-destructive" title="Remove" onClick={() => remove(i)}>×</button>
          </div>
        ))}
        <div>
          <Button type="button" size="sm" variant="outline" onClick={add} disabled={motifs.length === 0}>
            + Apply a design
          </Button>
          {motifs.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add a design to the drawer first.</p>}
        </div>
      </div>
    </FieldRow>
  )
}

// --- Catalog (in-house) garment picker --------------------------------------

type CatalogSetters = {
  setVariantId: (v: string) => void
  setBrand: (v: string) => void
  setModel: (v: string) => void
  setColor: (v: string) => void
  setSize: (v: string) => void
}

function CatalogGarmentPicker({
  initialVariantId,
  setters,
  error,
}: {
  initialVariantId: string
  setters: CatalogSetters
  error?: string
}) {
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [colors, setColors] = useState<{ color: string }[]>([])
  const [sizes, setSizes] = useState<{ id: string; size: string }[]>([])
  const [brandId, setBrandId] = useState('')
  const [productId, setProductId] = useState('')
  const [color, setColorState] = useState('')
  const [variantId, setVariantIdState] = useState(initialVariantId)
  const prefilled = useRef(false)

  // Brands once.
  useEffect(() => {
    let alive = true
    textileMasterDataService.getBrandNames().then(rows => { if (alive) setBrands(rows) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Edit prefill: resolve the existing variant back up the cascade once.
  useEffect(() => {
    if (prefilled.current || !initialVariantId) return
    prefilled.current = true
    let alive = true
    ;(async () => {
      const variant = await textileService.getVariantById(initialVariantId)
      if (!variant || !alive) return
      const product = await textileService.getProductById(variant.product_id)
      if (!alive) return
      setBrandId(product?.brand_id ?? '')
      setProductId(variant.product_id)
      setColorState(variant.color)
    })().catch(() => {})
    return () => { alive = false }
  }, [initialVariantId])

  // Cascade fetches. Stale downstream lists are harmless — each child Select is
  // disabled until its parent is set, and refetches when the parent changes.
  useEffect(() => {
    if (!brandId) return
    let alive = true
    textileService.getProductsByBrandId(brandId).then(rows => { if (alive) setProducts(rows.map(r => ({ id: r.id, name: r.name }))) }).catch(() => {})
    return () => { alive = false }
  }, [brandId])

  useEffect(() => {
    if (!productId) return
    let alive = true
    textileService.getVariantColorsByProduct(productId).then(rows => { if (alive) setColors(rows.map(r => ({ color: r.color }))) }).catch(() => {})
    return () => { alive = false }
  }, [productId])

  useEffect(() => {
    if (!productId || !color) return
    let alive = true
    textileService.getVariantSizesByProductAndColor(productId, color).then(rows => { if (alive) setSizes(rows.map(r => ({ id: r.id, size: r.size }))) }).catch(() => {})
    return () => { alive = false }
  }, [productId, color])

  const onBrand = (id: string) => { setBrandId(id); setProductId(''); setColorState(''); setVariantIdState(''); setters.setVariantId(''); setters.setBrand(brands.find(b => b.id === id)?.name ?? '') }
  const onProduct = (id: string) => { setProductId(id); setColorState(''); setVariantIdState(''); setters.setVariantId(''); setters.setModel(products.find(p => p.id === id)?.name ?? '') }
  const onColor = (c: string) => { setColorState(c); setVariantIdState(''); setters.setVariantId(''); setters.setColor(c) }
  const onSize = (variantRowId: string) => {
    setVariantIdState(variantRowId)
    setters.setVariantId(variantRowId)
    setters.setSize(sizes.find(s => s.id === variantRowId)?.size ?? '')
  }

  return (
    <FieldRow label="Catalog garment" error={error}>
      <div className="flex flex-col gap-2">
        <Select value={brandId || undefined} onValueChange={onBrand}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Brand…" /></SelectTrigger>
          <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={productId || undefined} onValueChange={onProduct} disabled={!brandId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Product…" /></SelectTrigger>
          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={color || undefined} onValueChange={onColor} disabled={!productId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Colour…" /></SelectTrigger>
            <SelectContent>{colors.map(c => <SelectItem key={c.color} value={c.color}>{c.color}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={variantId || undefined} onValueChange={onSize} disabled={!color}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Size…" /></SelectTrigger>
            <SelectContent>{sizes.map(s => <SelectItem key={s.id} value={s.id}>{s.size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </FieldRow>
  )
}

// --- Main form --------------------------------------------------------------

export function TextileGarmentForm(p: TextileGarmentFormProps) {
  const saveProduct = useSaveProduct()
  const { showError } = useToast()
  const [links, setLinks] = useState<TextileMotifLinkInput[]>(p.initialLinks)
  const initialVariantId = String((p.product?.child as { variant_id?: string | null } | undefined)?.variant_id ?? '')
  const [ownMode, setOwnMode] = useState<'CATALOG' | 'FREETEXT'>(initialVariantId ? 'CATALOG' : 'FREETEXT')

  const form = useForm({
    defaultValues: {
      origin: 'OWN_STOCK', variant_id: '', garment_type: '', brand: '', model: '', color: '', size: '', quantity: '',
      ...valuesFromProduct(p.product),
    } as FormValues,
    onSubmit: ({ value }) => {
      const merged = { ...value, links }
      if (Object.keys(validateProduct('TEXTILE_GARMENT', merged, p.jobStatus)).length > 0) return
      saveProduct.mutate(
        {
          input: buildWriteInput({
            product: p.product, job: p.job, type: 'TEXTILE_GARMENT',
            sortOrder: p.sortOrder, quantity: qtyOut(value.quantity), child: textileGarmentToChild(value),
          }),
          fileIds: [],
          jobId: p.job.id,
          links,
        },
        { onSuccess: ({ products }) => p.onSaved(products), onError: () => showError(p.product ? 'Garment could not be saved' : 'Garment could not be added') },
      )
    },
  })

  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={s => s.values}>
        {values => {
          const errors = validateProduct('TEXTILE_GARMENT', { ...values, links }, p.jobStatus) as Errs
          const origin = String(values.origin ?? '')
          return (
            <>
              <form.Field name="origin">{f => <SelectField field={f} label="Origin" options={ORIGIN_OPTS} error={errors.origin} />}</form.Field>

              {origin === 'OWN_STOCK' && (
                <>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={ownMode === 'CATALOG' ? 'default' : 'outline'} onClick={() => setOwnMode('CATALOG')}>Catalog</Button>
                    <Button type="button" size="sm" variant={ownMode === 'FREETEXT' ? 'default' : 'outline'} onClick={() => { setOwnMode('FREETEXT'); form.setFieldValue('variant_id', '') }}>Free text</Button>
                  </div>
                  {ownMode === 'CATALOG' ? (
                    <form.Field name="variant_id">
                      {vf => (
                        <CatalogGarmentPicker
                          initialVariantId={initialVariantId}
                          error={errors.brand ?? errors.model ?? errors.color ?? errors.size}
                          setters={{
                            setVariantId: v => vf.handleChange(v),
                            setBrand: v => form.setFieldValue('brand', v),
                            setModel: v => form.setFieldValue('model', v),
                            setColor: v => form.setFieldValue('color', v),
                            setSize: v => form.setFieldValue('size', v),
                          }}
                        />
                      )}
                    </form.Field>
                  ) : (
                    <>
                      <form.Field name="brand">{f => <TextField field={f} label="Brand" error={errors.brand} />}</form.Field>
                      <form.Field name="model">{f => <TextField field={f} label="Model" error={errors.model} />}</form.Field>
                      <form.Field name="color">{f => <TextField field={f} label="Colour" error={errors.color} />}</form.Field>
                      <form.Field name="size">{f => <TextField field={f} label="Size" error={errors.size} />}</form.Field>
                    </>
                  )}
                </>
              )}

              {origin === 'CUSTOMER_STOCK' && (
                <>
                  <form.Field name="garment_type">{f => <SelectField field={f} label="Garment" options={GARMENT_TYPE_OPTS} error={errors.garment_type} />}</form.Field>
                  <form.Field name="color">{f => <TextField field={f} label="Colour" error={errors.color} />}</form.Field>
                </>
              )}

              <form.Field name="quantity">{f => <QuantityField field={f} error={errors.quantity} />}</form.Field>

              <DesignLinksEditor links={links} motifs={p.motifs} error={errors.links} onChange={setLinks} />

              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={saveProduct.isPending} editing={!!p.product} onCancel={p.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}
