import type { Database } from '../../types/supabase'
import { STAMP_COLOR_LABELS } from '../../types/stamp'

export type StampModelRow = Database['public']['Tables']['stamp_models']['Row']

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'AUTO_DEDUCTION'

export type StampType =
  | 'TRODAT_PRINTY'
  | 'WOODEN_STAMP'
  | 'STAND_STAMP'
  | 'DATE_STAMP'
  | 'INK_PAD_PRODUCT'
  | 'TRODAT_PAD'

export const STAMP_TYPE_LABELS: Record<StampType, string> = {
  TRODAT_PRINTY: 'Trodat Printy',
  WOODEN_STAMP: 'Wooden Stamp',
  STAND_STAMP: 'Tripod Stamp',
  DATE_STAMP: 'Date Stamp',
  INK_PAD_PRODUCT: 'Stamp Pad',
  TRODAT_PAD: 'Trodat Pad',
}

export function typeLabel(type: string): string {
  return (STAMP_TYPE_LABELS as Record<string, string>)[type] ?? type
}

export const STAMP_TYPE_FILTER_OPTIONS: { value: StampType; label: string }[] = [
  { value: 'TRODAT_PRINTY', label: STAMP_TYPE_LABELS.TRODAT_PRINTY },
  { value: 'WOODEN_STAMP', label: STAMP_TYPE_LABELS.WOODEN_STAMP },
  { value: 'STAND_STAMP', label: STAMP_TYPE_LABELS.STAND_STAMP },
  { value: 'DATE_STAMP', label: STAMP_TYPE_LABELS.DATE_STAMP },
  { value: 'TRODAT_PAD', label: STAMP_TYPE_LABELS.TRODAT_PAD },
  { value: 'INK_PAD_PRODUCT', label: STAMP_TYPE_LABELS.INK_PAD_PRODUCT },
]

/** Display label for a stored ink-colour code; unknown codes pass through. */
export function colorLabel(colorCode: string | null | undefined): string {
  if (colorCode == null || colorCode === '') return '—'
  return (STAMP_COLOR_LABELS as Record<string, string>)[colorCode] ?? colorCode
}

export function formatNetRetailPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export type StampStatus = { badgeClass: string; label: string; rank: number }

export function statusInfo(model: StampModelRow): StampStatus {
  const stock = model.stock ?? 0
  const minimumStock = model.min_stock ?? 0
  if (stock <= 0) return { badgeClass: 'badge-rot', label: 'Out of stock', rank: 0 }
  if (stock < minimumStock) return { badgeClass: 'badge-rot', label: 'Reorder', rank: 0 }
  if (stock === minimumStock) return { badgeClass: 'badge-orange', label: 'At minimum', rank: 1 }
  return { badgeClass: 'badge-gruen', label: 'OK', rank: 2 }
}

export type OrderListRow = StampModelRow & {
  openQuantity: number
  orderQuantity: number
}
