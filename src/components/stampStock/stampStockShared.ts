import type { Database } from '../../types/supabase'

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

export type StampColorDb = 'BLACK' | 'RED' | 'BLUE' | 'GREEN'

export const STAMP_COLOR_LABELS: Record<StampColorDb, string> = {
  BLACK: 'Black',
  RED: 'Red',
  BLUE: 'Blue',
  GREEN: 'Green',
}

export function colorLabel(colorCode: string | null | undefined): string {
  if (colorCode == null || colorCode === '') return '—'
  if ((Object.keys(STAMP_COLOR_LABELS) as StampColorDb[]).includes(colorCode as StampColorDb)) {
    return STAMP_COLOR_LABELS[colorCode as StampColorDb]
  }
  return colorCode
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

/** Quantity from a legacy job-detail field; falls back to 1 for anything unusable. */
export function parseJobQuantity(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const floored = Math.floor(raw)
    return floored >= 1 ? floored : 1
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 1) return parsed
  }
  return 1
}

export type StampStatus = { cls: string; label: string; rank: number }

export function statusInfo(model: StampModelRow): StampStatus {
  const stock = model.stock ?? 0
  const minimumStock = model.min_stock ?? 0
  if (stock <= 0) return { cls: 'badge-rot', label: 'Out of stock', rank: 0 }
  if (stock < minimumStock) return { cls: 'badge-rot', label: 'Reorder', rank: 0 }
  if (stock === minimumStock) return { cls: 'badge-orange', label: 'At minimum', rank: 1 }
  return { cls: 'badge-gruen', label: 'OK', rank: 2 }
}

export type OrderListRow = StampModelRow & {
  openQuantity: number
  orderQuantity: number
}
