/**
 * Validation for Stamp (Stempel) products.
 *
 * Operates on the English typed fields of a stamp product (the child columns
 * plus the parent `quantity`), keyed by `type`. Field keys are English; the
 * stored enum VALUE strings (SCHWARZ, KLEIN, …) are kept as-is for now (the
 * value→English pass is deferred, shop-confirmed).
 *
 * Per type:
 * - `TRODAT_PRINTY`, `WOODEN_STAMP`: dimensions optional; require `model_id`.
 * - `STAND_STAMP`, `DATE_STAMP`, `OTHER_STAMP`: at least one dimension; color;
 *   description.
 * - `REFILL_INK`: color + ink_type.
 * - `INK_PAD`: pad_size + color.
 * - `TRODAT_PAD`: pad_article_number, color, pad_variant_id.
 * - `STAMP_PLATE`: dimensions only.
 *
 * In `QUOTE` stage nothing is required. Returns a map of field-key → message.
 */

import { STAMP_COLORS, type StampColor, type StampType, STAMP_TYPES } from '../../types/stamp'
import type { OrderStatus } from '../../types/database'

function parseRequiredString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  const trimmed = parseRequiredString(value)
  if (!trimmed) return null
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T[number]) : null
}

function isValidQuantity(value: unknown): boolean {
  if (value == null || value === '') return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 1
}

function parsePositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

type Err = Record<string, string>
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
}

const EXTRA_TYPES = ['REFILL_INK', 'INK_PAD', 'STAMP_PLATE', 'TRODAT_PAD'] as const
type ExtraType = (typeof EXTRA_TYPES)[number]
type AnyType = StampType | ExtraType

// Stored value strings (kept German for now — deferred value-rename pass).
const REFILL_INK_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const REFILL_INK_TYPES = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const STAMP_PAD_SIZES = ['KLEIN', 'MITTEL', 'GROSS'] as const

/**
 * @param type   the product type discriminator
 * @param fields English child columns + the parent `quantity`
 */
export function validateStampDetail(
  type: string | null,
  fields: Record<string, unknown>,
  subOrderStatus: OrderStatus,
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  const isKnownType =
    !!type && ((STAMP_TYPES as readonly string[]).includes(type) || (EXTRA_TYPES as readonly string[]).includes(type))
  if (!type || !isKnownType) {
    addError(errors, 'type', 'Select type')
    return errors
  }
  const stampType = type as AnyType

  // quantity
  if (!isValidQuantity(fields.quantity)) addError(errors, 'quantity', 'Integer ≥ 1')

  // dimensions (OR-required) for all except the model stamps and consumables
  const needsFormat =
    stampType !== 'REFILL_INK' &&
    stampType !== 'INK_PAD' &&
    stampType !== 'TRODAT_PAD' &&
    stampType !== 'TRODAT_PRINTY' &&
    stampType !== 'WOODEN_STAMP'
  if (needsFormat) {
    const width = parsePositiveInt(fields.width)
    const height = parsePositiveInt(fields.height)
    const hasOne = (width ?? 0) > 0 || (height ?? 0) > 0
    if (!hasOne) addError(errors, 'format', 'Provide at least width or height')
    if (fields.width != null && fields.width !== '' && width == null) addError(errors, 'width', 'Integer > 0')
    if (fields.height != null && fields.height !== '' && height == null) addError(errors, 'height', 'Integer > 0')
  }

  if (stampType === 'TRODAT_PRINTY' || stampType === 'WOODEN_STAMP') {
    if (!parseRequiredString(fields.model_id)) {
      addError(errors, 'model_id', 'Please select a stamp model')
    }
  }

  // type-specific required fields
  if (stampType === 'REFILL_INK') {
    if (!parseEnum(fields.color, REFILL_INK_COLORS)) addError(errors, 'color', 'Required')
    if (!parseEnum(fields.ink_type, REFILL_INK_TYPES)) addError(errors, 'ink_type', 'Required')
  } else if (stampType === 'INK_PAD') {
    if (!parseEnum(fields.pad_size, STAMP_PAD_SIZES)) addError(errors, 'pad_size', 'Required')
    if (!parseEnum(fields.color, REFILL_INK_COLORS)) addError(errors, 'color', 'Required')
  } else if (stampType === 'TRODAT_PAD') {
    if (!parseRequiredString(fields.pad_article_number)) addError(errors, 'pad_article_number', 'Required')
    if (!parseEnum(fields.color, REFILL_INK_COLORS)) addError(errors, 'color', 'Required')
    if (!parseRequiredString(fields.pad_variant_id)) addError(errors, 'pad_variant_id', 'Select colour variant')
  } else if (stampType === 'STAMP_PLATE') {
    // no color, no description
  } else {
    // classic stamps: color + description
    const color = parseRequiredString(fields.color) as StampColor | null
    if (!color || !STAMP_COLORS.includes(color as StampColor)) addError(errors, 'color', 'Required')
    if (color === 'SONSTIGE' && !parseRequiredString(fields.color_other)) addError(errors, 'color_other', 'Required')
    if (!parseRequiredString(fields.description)) addError(errors, 'description', 'Required')
  }
  return errors
}
