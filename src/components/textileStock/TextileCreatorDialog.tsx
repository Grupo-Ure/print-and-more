import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useToast } from '../Toast'
import { errorToString } from '../../lib/errorToString'
import {
  useCreateTextileEntities,
  type BrandTarget,
  type CreateTextileEntitiesResult,
  type ProductTarget,
} from '../../queries/textileStockQueries'
import { stockInputClass } from '../stock/stockShared'
import { VariantFields, type VariantFieldsHandle } from './VariantFields'

/** Topmost entity being created; everything below it is optional. */
export type CreatorLevel = 'BRAND' | 'PRODUCT' | 'VARIANT'

const TITLES: Record<CreatorLevel, string> = {
  BRAND: 'New brand',
  PRODUCT: 'New product',
  VARIANT: 'New variants',
}

const SUBMIT_LABELS: Record<CreatorLevel, string> = {
  BRAND: 'Create brand',
  PRODUCT: 'Create product',
  VARIANT: 'Create variants',
}

type TextileCreatorDialogProps = {
  level: CreatorLevel
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent brand — required from PRODUCT down. */
  brandId?: string
  /** Parent product — required at VARIANT level. */
  productId?: string
  onCreated?: (result: CreateTextileEntitiesResult) => void
}

/**
 * The one creation dialog of the textile catalog. It always creates the level
 * it was opened at and offers each level below it behind a switch that is on
 * by default: brands are made to hold products, products to hold variants,
 * and only variants carry stock — so the whole branch is normally filled in
 * one pass. Turning a switch off stops the chain there.
 */
export function TextileCreatorDialog({
  level,
  open,
  onOpenChange,
  brandId,
  productId,
  onCreated,
}: TextileCreatorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITLES[level]}</DialogTitle>
        </DialogHeader>
        {/* Remount per opening so every dialog starts empty. */}
        {open && (
          <CreatorBody
            level={level}
            brandId={brandId}
            productId={productId}
            onOpenChange={onOpenChange}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreatorBody({
  level,
  brandId,
  productId,
  onOpenChange,
  onCreated,
}: Omit<TextileCreatorDialogProps, 'open'>) {
  const { showError, showSuccess } = useToast()
  const createEntities = useCreateTextileEntities()
  const variantFieldsRef = useRef<VariantFieldsHandle>(null)

  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [articleNumber, setArticleNumber] = useState('')
  const [description, setDescription] = useState('')
  // Each level below the starting one is opt-out, never opt-in.
  const [withProduct, setWithProduct] = useState(true)
  const [withVariant, setWithVariant] = useState(true)

  // Levels above the opening one don't exist here (rendered out); levels
  // below it stay visible and are only disabled when switched off.
  const showsBrand = level === 'BRAND'
  const productEnabled = level !== 'BRAND' || withProduct
  // A variant needs a product to hang on: dropping the product drops it too.
  const variantEnabled = level === 'VARIANT' || (productEnabled && withVariant)

  const submit = async (): Promise<void> => {
    let brand: BrandTarget
    if (showsBrand) {
      const trimmed = brandName.trim()
      if (!trimmed) {
        showError('Brand name is required')
        return
      }
      brand = { name: trimmed }
    } else {
      if (!brandId) {
        showError('No brand selected')
        return
      }
      brand = { id: brandId }
    }

    let product: ProductTarget | undefined
    if (level === 'VARIANT') {
      if (!productId) {
        showError('No product selected')
        return
      }
      product = { id: productId }
    } else if (productEnabled) {
      const trimmed = productName.trim()
      if (!trimmed) {
        showError('Product name is required')
        return
      }
      product = {
        name: trimmed,
        article_number: articleNumber.trim() || null,
        description: description.trim() || null,
      }
    }

    let variants: ReturnType<NonNullable<VariantFieldsHandle['buildRows']>> = []
    if (variantEnabled) {
      // The fields toast what is missing and return null.
      const built = variantFieldsRef.current?.buildRows()
      if (!built) return
      variants = built
    }

    try {
      const result = await createEntities.mutateAsync({ brand, product, variants: variants ?? [] })
      showSuccess(successMessage(level, result))
      onOpenChange(false)
      onCreated?.(result)
    } catch (error) {
      showError(errorToString(error))
    }
  }

  return (
    <div>
      {showsBrand && (
        <div className="mb-3 rounded-xl border border-border bg-background p-3">
          <div className="mb-1.5 text-sm font-bold">Brand</div>
          <input
            className={cn(stockInputClass, 'w-full')}
            placeholder="Name (required)"
            value={brandName}
            onChange={event => setBrandName(event.target.value)}
            aria-label="Brand name"
            autoFocus
          />
        </div>
      )}

      {showsBrand && (
        <SectionSwitch
          label="Create the first product"
          checked={withProduct}
          onCheckedChange={setWithProduct}
        />
      )}

      {level !== 'VARIANT' && (
        <div
          className={cn(
            'mb-3 rounded-xl border border-border bg-background p-3 transition-opacity',
            !productEnabled && 'opacity-50',
          )}
          aria-disabled={!productEnabled || undefined}
        >
          <div className="mb-1.5 text-sm font-bold">Product</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            <input
              className={stockInputClass}
              placeholder="Name (required)"
              value={productName}
              onChange={event => setProductName(event.target.value)}
              aria-label="Product name"
              autoFocus={level === 'PRODUCT'}
              disabled={!productEnabled}
            />
            <input
              className={stockInputClass}
              placeholder="Article number"
              value={articleNumber}
              onChange={event => setArticleNumber(event.target.value)}
              aria-label="Article number"
              disabled={!productEnabled}
            />
            <input
              className={cn(stockInputClass, 'col-span-full')}
              placeholder="Description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              aria-label="Description"
              disabled={!productEnabled}
            />
          </div>
        </div>
      )}

      {level !== 'VARIANT' && (
        <SectionSwitch
          label="Create variants"
          checked={withVariant}
          onCheckedChange={setWithVariant}
          disabled={!productEnabled}
        />
      )}

      <VariantFields ref={variantFieldsRef} disabled={!variantEnabled} />

      <DialogFooter>
        <Button type="button" onClick={() => void submit()} disabled={createEntities.isPending}>
          {SUBMIT_LABELS[level]}
        </Button>
      </DialogFooter>
    </div>
  )
}

function SectionSwitch({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** A switched-off level above disables this one — visible but inert. */
  disabled?: boolean
}) {
  return (
    <div className={cn('mb-2 flex items-center gap-2.5 transition-opacity', disabled && 'opacity-50')}>
      <span className="text-sm font-bold">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} disabled={disabled} />
    </div>
  )
}

function successMessage(level: CreatorLevel, result: CreateTextileEntitiesResult): string {
  const variantPart =
    result.variantCount === 0
      ? 'no variants'
      : `${result.variantCount} ${result.variantCount === 1 ? 'variant' : 'variants'}`
  if (level === 'VARIANT') {
    return result.variantCount === 0 ? 'No new variants — all already exist' : `${variantPart} created`
  }
  const created = level === 'BRAND' ? 'Brand' : 'Product'
  if (level === 'BRAND' && !result.productId) return 'Brand created — no product yet'
  return `${created} created with ${variantPart}`
}
