import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Json } from '../types/supabase'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Flattens a sub-order `detail` JSONB value into a plain field map for validation and display. Arrays and primitives at the top level return an empty map. */
export function subOrderDetailToFieldMap(detail: Json | null): Record<string, unknown> {
  if (detail === null) return {}
  if (typeof detail === 'object' && !Array.isArray(detail)) {
    return detail
  }
  return {}
}
