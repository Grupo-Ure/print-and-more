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

type FieldErrors = Record<string, string>

/** Garment form needs the job's designs (for the link picker) and the
 *  edited product's existing links (for prefill). */
export type TextileGarmentFormProps = ProductFormProps & {
  motifs: TextileMotifRow[]
  initialLinks: TextileMotifLinkInput[]
}

const ORIGIN_OPTIONS: Option[] = [
  { value: 'OWN_STOCK', label: 'In-house stock' },
  { value: 'CUSTOMER_STOCK', label: 'Customer-supplied' },
]
const GARMENT_TYPE_OPTIONS: Option[] = [
  { value: 'T_SHIRT', label: 'T-Shirt' },
  { value: 'POLO', label: 'Polo' },
  { value: 'SWEATSHIRT', label: 'Sweatshirt' },
  { value: 'HOODIE', label: 'Hoodie' },
  { value: 'ZIP_HOODIE', label: 'Zip Hoodie' },
  { value: 'JACKE', label: 'Jacket' },
  { value: 'SONSTIGES', label: 'Other' },
]
const PLACEMENT_OPTIONS: Option[] = [
  { value: 'BRUST_LINKS', label: 'Chest left' },
  { value: 'BRUST_MITTE', label: 'Chest centre' },
  { value: 'BRUST_RECHTS', label: 'Chest right' },
  { value: 'RUECKEN', label: 'Back' },
  { value: 'ARM_LINKS', label: 'Sleeve left' },
  { value: 'ARM_RECHTS', label: 'Sleeve right' },
  { value: 'SONSTIGE', label: 'Other' },
]
const APPLICATION_SIZE_OPTIONS: Option[] = [
  { value: 'KLEIN', label: 'Small' },
  { value: 'MITTEL', label: 'Medium' },
  { value: 'GROSS', label: 'Large' },
  { value: 'FREI', label: 'Custom' },
]

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); onSubmit() }} className="flex flex-col gap-3">
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
  const updateLink = (targetIndex: number, patch: Partial<TextileMotifLinkInput>) =>
    onChange(links.map((link, index) => (index === targetIndex ? { ...link, ...patch } : link)))
  const removeLink = (targetIndex: number) => onChange(links.filter((_, index) => index !== targetIndex))
  const addLink = () => onChange([...links, { motif_id: '', placement: '', size: '', print_method: null }])

  return (
    <FieldRow label="Designs applied" error={error}>
      <div className="flex flex-col gap-2">
        {links.length === 0 && <p className="text-xs text-muted-foreground">No designs applied yet.</p>}
        {links.map((link, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <Select value={link.motif_id || undefined} onValueChange={motifId => updateLink(index, { motif_id: motifId })}>
              <SelectTrigger size="sm" className="w-44"><SelectValue placeholder="Design…" /></SelectTrigger>
              <SelectContent>
                {motifs.map(motif => <SelectItem key={motif.id} value={motif.id}>{motifLabel(motif)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={link.placement || undefined} onValueChange={placement => updateLink(index, { placement })}>
              <SelectTrigger size="sm" className="w-36"><SelectValue placeholder="Placement…" /></SelectTrigger>
              <SelectContent>
                {PLACEMENT_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={link.size || undefined} onValueChange={size => updateLink(index, { size })}>
              <SelectTrigger size="sm" className="w-28"><SelectValue placeholder="Size…" /></SelectTrigger>
              <SelectContent>
                {APPLICATION_SIZE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <button type="button" className="cursor-pointer text-muted-foreground hover:text-destructive" title="Remove" onClick={() => removeLink(index)}>×</button>
          </div>
        ))}
        <div>
          <Button type="button" size="sm" variant="outline" onClick={addLink} disabled={motifs.length === 0}>
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
  setVariantId: (variantId: string) => void
  setBrand: (brandName: string) => void
  setModel: (modelName: string) => void
  setColor: (colorName: string) => void
  setSize: (sizeName: string) => void
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
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId)
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
      setSelectedColor(variant.color)
    })().catch(() => {})
    return () => { alive = false }
  }, [initialVariantId])

  // Cascade fetches. Stale downstream lists are harmless — each child Select is
  // disabled until its parent is set, and refetches when the parent changes.
  useEffect(() => {
    if (!brandId) return
    let alive = true
    textileService.getProductsByBrandId(brandId).then(rows => { if (alive) setProducts(rows.map(row => ({ id: row.id, name: row.name }))) }).catch(() => {})
    return () => { alive = false }
  }, [brandId])

  useEffect(() => {
    if (!productId) return
    let alive = true
    textileService.getVariantColorsByProduct(productId).then(rows => { if (alive) setColors(rows.map(row => ({ color: row.color }))) }).catch(() => {})
    return () => { alive = false }
  }, [productId])

  useEffect(() => {
    if (!productId || !selectedColor) return
    let alive = true
    textileService.getVariantSizesByProductAndColor(productId, selectedColor).then(rows => { if (alive) setSizes(rows.map(row => ({ id: row.id, size: row.size }))) }).catch(() => {})
    return () => { alive = false }
  }, [productId, selectedColor])

  const handleBrandChange = (nextBrandId: string) => {
    setBrandId(nextBrandId)
    setProductId('')
    setSelectedColor('')
    setSelectedVariantId('')
    setters.setVariantId('')
    setters.setBrand(brands.find(brand => brand.id === nextBrandId)?.name ?? '')
  }
  const handleProductChange = (nextProductId: string) => {
    setProductId(nextProductId)
    setSelectedColor('')
    setSelectedVariantId('')
    setters.setVariantId('')
    setters.setModel(products.find(product => product.id === nextProductId)?.name ?? '')
  }
  const handleColorChange = (nextColor: string) => {
    setSelectedColor(nextColor)
    setSelectedVariantId('')
    setters.setVariantId('')
    setters.setColor(nextColor)
  }
  const handleSizeChange = (variantRowId: string) => {
    setSelectedVariantId(variantRowId)
    setters.setVariantId(variantRowId)
    setters.setSize(sizes.find(sizeOption => sizeOption.id === variantRowId)?.size ?? '')
  }

  return (
    <FieldRow label="Catalog garment" error={error}>
      <div className="flex flex-col gap-2">
        <Select value={brandId || undefined} onValueChange={handleBrandChange}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Brand…" /></SelectTrigger>
          <SelectContent>{brands.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={productId || undefined} onValueChange={handleProductChange} disabled={!brandId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Product…" /></SelectTrigger>
          <SelectContent>{products.map(product => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={selectedColor || undefined} onValueChange={handleColorChange} disabled={!productId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Colour…" /></SelectTrigger>
            <SelectContent>{colors.map(colorOption => <SelectItem key={colorOption.color} value={colorOption.color}>{colorOption.color}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedVariantId || undefined} onValueChange={handleSizeChange} disabled={!selectedColor}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Size…" /></SelectTrigger>
            <SelectContent>{sizes.map(sizeOption => <SelectItem key={sizeOption.id} value={sizeOption.id}>{sizeOption.size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </FieldRow>
  )
}

// --- Main form --------------------------------------------------------------

export function TextileGarmentForm(props: TextileGarmentFormProps) {
  const saveProduct = useSaveProduct()
  const { showError } = useToast()
  const [links, setLinks] = useState<TextileMotifLinkInput[]>(props.initialLinks)
  const initialVariantId = props.product?.type === 'TEXTILE_GARMENT' ? (props.product.child.variant_id ?? '') : ''
  const [ownStockMode, setOwnStockMode] = useState<'CATALOG' | 'FREETEXT'>(initialVariantId ? 'CATALOG' : 'FREETEXT')

  const form = useForm({
    defaultValues: {
      origin: 'OWN_STOCK', variant_id: '', garment_type: '', brand: '', model: '', color: '', size: '', quantity: '',
      ...valuesFromProduct(props.product),
    } as FormValues,
    onSubmit: ({ value }) => {
      const valuesWithLinks = { ...value, links }
      if (Object.keys(validateProduct('TEXTILE_GARMENT', valuesWithLinks, props.orderIsQuote)).length > 0) return
      saveProduct.mutate(
        {
          input: buildWriteInput({
            product: props.product, job: props.job, type: 'TEXTILE_GARMENT',
            sortOrder: props.sortOrder, quantity: qtyOut(value.quantity), child: textileGarmentToChild(value),
          }),
          fileIds: [],
          jobId: props.job.id,
          orderId: props.job.order_id,
          links,
        },
        { onSuccess: ({ products }) => props.onSaved(products), onError: () => showError(props.product ? 'Garment could not be saved' : 'Garment could not be added') },
      )
    },
  })

  return (
    <FormShell onSubmit={() => void form.handleSubmit()}>
      <form.Subscribe selector={state => state.values}>
        {values => {
          const errors = validateProduct('TEXTILE_GARMENT', { ...values, links }, props.orderIsQuote) as FieldErrors
          const origin = String(values.origin ?? '')
          return (
            <>
              <form.Field name="origin">{field => <SelectField field={field} label="Origin" options={ORIGIN_OPTIONS} error={errors.origin} />}</form.Field>

              {origin === 'OWN_STOCK' && (
                <>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={ownStockMode === 'CATALOG' ? 'default' : 'outline'} onClick={() => setOwnStockMode('CATALOG')}>Catalog</Button>
                    <Button type="button" size="sm" variant={ownStockMode === 'FREETEXT' ? 'default' : 'outline'} onClick={() => { setOwnStockMode('FREETEXT'); form.setFieldValue('variant_id', '') }}>Free text</Button>
                  </div>
                  {ownStockMode === 'CATALOG' ? (
                    <form.Field name="variant_id">
                      {variantField => (
                        <CatalogGarmentPicker
                          initialVariantId={initialVariantId}
                          error={errors.brand ?? errors.model ?? errors.color ?? errors.size}
                          setters={{
                            setVariantId: variantId => variantField.handleChange(variantId),
                            setBrand: brandName => form.setFieldValue('brand', brandName),
                            setModel: modelName => form.setFieldValue('model', modelName),
                            setColor: colorName => form.setFieldValue('color', colorName),
                            setSize: sizeName => form.setFieldValue('size', sizeName),
                          }}
                        />
                      )}
                    </form.Field>
                  ) : (
                    <>
                      <form.Field name="brand">{field => <TextField field={field} label="Brand" error={errors.brand} />}</form.Field>
                      <form.Field name="model">{field => <TextField field={field} label="Model" error={errors.model} />}</form.Field>
                      <form.Field name="color">{field => <TextField field={field} label="Colour" error={errors.color} />}</form.Field>
                      <form.Field name="size">{field => <TextField field={field} label="Size" error={errors.size} />}</form.Field>
                    </>
                  )}
                </>
              )}

              {origin === 'CUSTOMER_STOCK' && (
                <>
                  <form.Field name="garment_type">{field => <SelectField field={field} label="Garment" options={GARMENT_TYPE_OPTIONS} error={errors.garment_type} />}</form.Field>
                  <form.Field name="color">{field => <TextField field={field} label="Colour" error={errors.color} />}</form.Field>
                </>
              )}

              <form.Field name="quantity">{field => <QuantityField field={field} error={errors.quantity} />}</form.Field>

              <DesignLinksEditor links={links} motifs={props.motifs} error={errors.links} onChange={setLinks} />

              <FormActions canSubmit={Object.keys(errors).length === 0} submitting={saveProduct.isPending} editing={!!props.product} onCancel={props.onCancel} />
            </>
          )
        }}
      </form.Subscribe>
    </FormShell>
  )
}
