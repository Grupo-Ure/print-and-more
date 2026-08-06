import type { VariantWithDetails } from '../../services/textileMasterDataService'
import { stockStatus, type StockStatus } from '../stock/stockShared'

export type VariantRow = VariantWithDetails

export const SIZE_RUNS = {
  STANDARD: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
  REDUCED: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  KIDS: ['98/104', '110/116', '122/128', '134/146', '152/161'],
  UNISEX: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
} as const

export type SizeRunPreset = keyof typeof SIZE_RUNS | 'CUSTOM'

export function sizesForPreset(preset: SizeRunPreset, customSizes: readonly string[]): string[] {
  if (preset === 'CUSTOM') return [...customSizes]
  return [...SIZE_RUNS[preset]]
}

export function sizeRunLabel(preset: SizeRunPreset, customSizes: readonly string[]): string {
  switch (preset) {
    case 'STANDARD':
      return 'XS–5XL'
    case 'REDUCED':
      return 'XS–3XL'
    case 'KIDS':
      return 'Kids'
    case 'UNISEX':
      return 'Unisex (XS–5XL)'
    case 'CUSTOM':
      return customSizes.length ? customSizes.join(' · ') : 'Custom'
  }
}

function oneNested<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function brandFromVariant(variant: VariantRow): string {
  const product = oneNested(variant.textile_products)
  return oneNested(product?.textile_brands)?.name ?? ''
}

export function productNameFromVariant(variant: VariantRow): string {
  return oneNested(variant.textile_products)?.name ?? '—'
}

/** Samples are outside the stock logic and always show as a grey chip. */
export function variantStatus(variant: VariantRow): StockStatus {
  if (variant.is_sample) return { badgeClass: 'badge-grau', label: 'Sample', rank: -1 }
  return stockStatus(variant.stock, variant.min_stock)
}
