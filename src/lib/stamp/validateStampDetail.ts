/**
 * Validation for Stamp (Stempel) sub-order detail.
 *
 * The Stamp validator accepts both the core stamp typen ({@link STAMP_TYPES})
 * and a set of "extra" typen for consumables: refill ink
 * (`REFILL_INK`), stamp pads (`INK_PAD`), Trodat replacement
 * pads (`TRODAT_PAD`), and replacement plates (`STAMP_PLATE`).
 * Each typ has its own required fields:
 *
 * - `TRODAT_PRINTY`, `WOODEN_STAMP`: dimensions optional; require
 *   `modell_id` from the catalog of stamp models.
 * - `STAND_STAMP`, `DATE_STAMP`, `OTHER_STAMP`: at least one
 *   dimension; ink color; description.
 * - `REFILL_INK`: ink color + ink type (NORMAL / HAUTVERTRAEGLICH /
 *   TEXTIL).
 * - `INK_PAD`: pad size (KLEIN / MITTEL / GROSS) + ink color.
 * - `TRODAT_PAD`: article number, ink color, and selected variant.
 * - `STAMP_PLATE`: dimensions only (no color, no description).
 *
 * In `ANGEBOT` (quote stage) nothing is required regardless of typ.
 *
 * Returns a map of field-key → German error message; an empty map means
 * the detail is valid.
 */

import {
  STAMP_COLORS,
  type StampDetailJson,
  type StampColor,
  type StampType,
  STAMP_TYPES,
} from '../../types/stamp'
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

function hasValidCount(detail: StampDetailJson): boolean {
  // Both `anzahl` and `stueckzahl` are accepted depending on the typ.
  return isValidQuantity(detail.anzahl) || isValidQuantity(detail.stueckzahl)
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

const REFILL_INK_COLORS = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const REFILL_INK_TYPES = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const STAMP_PAD_SIZES = ['KLEIN', 'MITTEL', 'GROSS'] as const

export function validateStampDetail(
  typ: string | null,
  detail: StampDetailJson,
  subOrderStatus: OrderStatus
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  const isKnownTyp =
    !!typ && ((STAMP_TYPES as readonly string[]).includes(typ) || (EXTRA_TYPES as readonly string[]).includes(typ))
  if (!typ || !isKnownTyp) {
    addError(errors, 'typ', 'Select type')
    return errors
  }
  const stampType = typ as AnyType

  // Anzahl / Stückzahl
  if (stampType === 'TRODAT_PAD') {
    if (!isValidQuantity(detail.stueckzahl)) addError(errors, 'stueckzahl', 'Integer ≥ 1')
  } else {
    if (!hasValidCount(detail)) addError(errors, 'stueckzahl', 'Integer ≥ 1')
  }

  // Maße (OR-Pflicht) für alle außer REFILL_INK, INK_PAD, TRODAT_PAD, TRODAT_PRINTY, WOODEN_STAMP
  const needsFormat =
    stampType !== 'REFILL_INK' &&
    stampType !== 'INK_PAD' &&
    stampType !== 'TRODAT_PAD' &&
    stampType !== 'TRODAT_PRINTY' &&
    stampType !== 'WOODEN_STAMP'
  if (needsFormat) {
    const width = parsePositiveInt(detail.format_breite)
    const height = parsePositiveInt(detail.format_hoehe)
    const hasOne = (width ?? 0) > 0 || (height ?? 0) > 0
    if (!hasOne) addError(errors, 'format', 'Provide at least width or height')
    if (detail.format_breite != null && detail.format_breite !== '' && width == null) addError(errors, 'format_breite', 'Integer > 0')
    if (detail.format_hoehe != null && detail.format_hoehe !== '' && height == null) addError(errors, 'format_hoehe', 'Integer > 0')
  }

  if (stampType === 'TRODAT_PRINTY' || stampType === 'WOODEN_STAMP') {
    if (!parseRequiredString(detail?.modell_id)) {
      addError(errors, 'modell_id', 'Please select a stamp model')
    }
  }

  // Typ-spezifische Pflichtfelder
  if (stampType === 'REFILL_INK') {
    const inkColor = parseEnum(detail.farbe, REFILL_INK_COLORS)
    if (!inkColor) addError(errors, 'farbe', 'Required')
    const inkType = parseEnum(detail.tinte_typ, REFILL_INK_TYPES)
    if (!inkType) addError(errors, 'tinte_typ', 'Required')
  } else if (stampType === 'INK_PAD') {
    const padSize = parseEnum(detail.groesse, STAMP_PAD_SIZES)
    if (!padSize) addError(errors, 'groesse', 'Required')
    const inkColor = parseEnum(detail.farbe, REFILL_INK_COLORS)
    if (!inkColor) addError(errors, 'farbe', 'Required')
  } else if (stampType === 'TRODAT_PAD') {
    if (!parseRequiredString((detail as Record<string, unknown>).kissen_artikelnummer)) addError(errors, 'kissen_artikelnummer', 'Required')
    const inkColor = parseEnum(detail.farbe, REFILL_INK_COLORS)
    if (!inkColor) addError(errors, 'farbe', 'Required')
    if (!parseRequiredString((detail as Record<string, unknown>).kissen_modell_id)) addError(errors, 'kissen_modell_id', 'Select colour variant')
  } else if (stampType === 'STAMP_PLATE') {
    // Keine Farbe, keine Beschreibung.
  } else {
    // Standard-Stempel: Farbe + Beschreibung
    const color = parseRequiredString(detail.farbe) as StampColor | null
    if (!color || !STAMP_COLORS.includes(color as StampColor)) addError(errors, 'farbe', 'Required')
    if (color === 'SONSTIGE' && !parseRequiredString(detail.farbe_sonstige)) addError(errors, 'farbe_sonstige', 'Required')
    if (!parseRequiredString(detail.beschreibung)) addError(errors, 'beschreibung', 'Required')
  }
  return errors
}
