/** Stamp type lists for the dropdown + table (incl. the consumable "extra" types). */

import { STAMP_TYPE_LABELS } from '../../../types/stamp'

export const STAMP_ALL_TYPES = ['TRODAT_PRINTY', 'WOODEN_STAMP', 'STAND_STAMP', 'DATE_STAMP', 'OTHER_STAMP', 'STAMP_PLATE', 'REFILL_INK', 'INK_PAD', 'TRODAT_PAD'] as const

export const STAMP_ALL_LABELS: Record<string, string> = {
  ...STAMP_TYPE_LABELS,
  STAMP_PLATE: 'Stamp Plate',
  REFILL_INK: 'Refill Ink',
  INK_PAD: 'Ink Pad',
  TRODAT_PAD: 'Trodat Pad',
}
