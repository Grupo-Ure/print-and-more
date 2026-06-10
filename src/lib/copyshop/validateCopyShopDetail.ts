/**
 * Validation for CopyShop products.
 *
 * Operates on the English typed fields of a CopyShop product (the child columns
 * plus the parent `quantity`), keyed by `type`. Field keys and error keys are
 * English; the stored enum VALUE strings (A4, DIN_LANG, FREI, 1_0, 4_4, CC,
 * OFFSET, OFFEN, MITTELFALZ, …) are kept as-is for now (the value→English pass
 * is deferred, shop-confirmed).
 *
 * Each CopyShop `type` (poster, card/flyer, folded flyer, brochure, business
 * card, binding, ad-hoc print-out) has its own required child columns. The
 * validator handles two production paths (Copy-Center vs offset) with different
 * material and format rules. In `QUOTE` (quote stage) nothing is required.
 *
 * Returns a map of field-key → message; an empty map means the product is valid.
 */

import { COPY_SHOP_TYPES, type CopyShopType } from '../../types/copyshop'
import type { OrderStatus } from '../../types/database'

function parseRequiredString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function requireBoolPresent(value: unknown): 'ok' | 'missing' {
  if (value === true || value === false) return 'ok'
  return 'missing'
}

function parseMmDimension(value: unknown): number | null {
  if (value === '' || value == null) return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function hasDimension(width: unknown, height: unknown): boolean {
  return parseMmDimension(width) != null || parseMmDimension(height) != null
}

const MSG_MASSE = 'Provide at least width or height'

function isValidQuantity(value: unknown): boolean {
  if (value == null || value === '') return false
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 1
}

function parseIntWithMin(value: unknown, min: number): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < min) return null
  return parsed
}

type Err = Record<string, string>
type Fields = Record<string, unknown>
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
}

const CC_G = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'] as const

function validateCcMaterialPair(fields: Fields, errors: Err, materialKey: string, otherKey: string) {
  const material = parseRequiredString(fields[materialKey])
  if (!material || !(CC_G as readonly string[]).includes(material)) addError(errors, materialKey, 'Required')
  if (material === 'SONSTIGE' && !parseRequiredString(fields[otherKey])) addError(errors, otherKey, 'Required')
}

function validateCardFoldFormat(isFolded: boolean, fields: Fields, errors: Err) {
  const format = parseRequiredString(fields.format)
  const validCardFormats = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'A3', 'FREI']
  const validFoldFormats = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'FREI']
  if (isFolded) {
    if (!validFoldFormats.includes(format ?? '')) addError(errors, 'format', 'Required')
  } else {
    if (!validCardFormats.includes(format ?? '')) addError(errors, 'format', 'Required')
  }
  if (format === 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
  else if (format && format !== 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
}

function validateOffsetMaterial(fields: Fields, errors: Err) {
  const offsetType = parseRequiredString(fields.offset_type)
  if (!['STANDARD', 'OFFSET', 'SPEZIAL'].includes(offsetType ?? '')) addError(errors, 'offset_type', 'Required')
  if (offsetType === 'STANDARD') {
    if (!['115G', '135G', '170G', '250G', '300G', '350G', '400G'].includes(parseRequiredString(fields.offset_weight) ?? '')) {
      addError(errors, 'offset_weight', 'Required')
    }
    if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(fields.offset_finish) ?? '')) {
      addError(errors, 'offset_finish', 'Required')
    }
  } else if (offsetType === 'OFFSET') {
    if (!['80G', '90G', '100G', '120G', '150G', '250G'].includes(parseRequiredString(fields.offset_weight) ?? '')) {
      addError(errors, 'offset_weight', 'Required')
    }
  } else if (offsetType === 'SPEZIAL') {
    const specialPaper = parseRequiredString(fields.special_paper)
    if (!['300G_FOLIENKASCHIERT', 'RECYCLING', '250G_LEINENSTRUKTUR', 'SONSTIGE'].includes(specialPaper ?? '')) {
      addError(errors, 'special_paper', 'Required')
    } else if (specialPaper === '300G_FOLIENKASCHIERT') {
      if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(fields.lamination_finish) ?? '')) addError(errors, 'lamination_finish', 'Required')
      if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString(fields.lamination_sides) ?? '')) {
        addError(errors, 'lamination_sides', 'Required')
      }
    } else if (specialPaper === 'RECYCLING') {
      if (!['80G', '135G', '150G', '300G'].includes(parseRequiredString(fields.recycling_weight) ?? '')) {
        addError(errors, 'recycling_weight', 'Required')
      }
    } else if (specialPaper === 'SONSTIGE') {
      if (!parseRequiredString(fields.special_paper_other)) addError(errors, 'special_paper_other', 'Required')
    }
  }
}

function validateBrochureOffsetOrOpen(fields: Fields, errors: Err) {
  if (
    !['DRAHTHEFTUNG', 'RINGSÖSEN', 'KLEBEBINDUNG', 'SPIRALBINDUNG'].includes(parseRequiredString(fields.binding) ?? '')
  ) {
    addError(errors, 'binding', 'Required')
  }
  if (!['135G', '170G', '250G', '300G'].includes(parseRequiredString(fields.cover_weight) ?? '')) {
    addError(errors, 'cover_weight', 'Required')
  }
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(fields.cover_finish) ?? '')) {
    addError(errors, 'cover_finish', 'Required')
  }
  if (!['90G', '135G', '170G'].includes(parseRequiredString(fields.inner_weight) ?? '')) {
    addError(errors, 'inner_weight', 'Required')
  }
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString(fields.inner_finish) ?? '')) {
    addError(errors, 'inner_finish', 'Required')
  }
}

function validateFoldPageCount(fields: Fields, errors: Err) {
  const pageCount = parseIntWithMin(fields.page_count, 2)
  if (pageCount == null) addError(errors, 'page_count', 'Required')
  else if (pageCount > 100) addError(errors, 'page_count', 'Max. 100')
  else if (pageCount % 2 !== 0) addError(errors, 'page_count', 'Even numbers only (2–100)')
}

function validateBrochurePageCount(fields: Fields, errors: Err) {
  const pageCount = parseIntWithMin(fields.page_count, 4)
  if (pageCount == null) addError(errors, 'page_count', 'Required')
  else if (pageCount > 152) addError(errors, 'page_count', 'Max. 152')
  else if (pageCount % 4 !== 0) addError(errors, 'page_count', 'Page count must be divisible by 4')
}

function validateBrochureFormat(fields: Fields, errors: Err) {
  const format = parseRequiredString(fields.format)
  if (!['A6', 'A5', 'A4', 'FREI'].includes(format ?? '')) addError(errors, 'format', 'Required')
  if (format === 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
  else if (format && format !== 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
}

function isBindingColorValid(bindingType: string | null, color: string | null): boolean {
  if (!bindingType || !color) return false
  const sets: Record<string, string[]> = {
    WIRE_O: ['SCHWARZ', 'SILBER'],
    KUNSTSTOFFSPIRALE: ['SCHWARZ', 'WEISS'],
    SOFTCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
    HARDCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
  }
  return sets[bindingType]?.includes(color) ?? false
}

/**
 * Validate a CopyShop product's type + fields against its current status.
 *
 * @param type   the product type discriminator
 * @param fields English child columns + the parent `quantity`
 *
 * Returns a map of field-key → message; empty map means valid. In `QUOTE` no
 * fields are required. Otherwise the type must be one of {@link COPY_SHOP_TYPES},
 * `quantity` must be a positive integer, and the type-specific keys (production
 * path, format, material, paper weight, finishing options, etc.) must be set.
 */
export function validateCopyShopDetail(
  type: string | null,
  fields: Record<string, unknown>,
  subOrderStatus: OrderStatus,
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!type || !COPY_SHOP_TYPES.includes(type as CopyShopType)) {
    addError(errors, 'type', 'Select type')
    return errors
  }
  if (!isValidQuantity(fields.quantity)) addError(errors, 'quantity', 'Integer ≥ 1')
  const copyShopType = type as CopyShopType
  const productionPath = fields.production_path
  if (copyShopType === 'CARD_FLYER' || copyShopType === 'FOLDED_FLYER' || copyShopType === 'BROCHURE') {
    if (!['CC', 'OFFSET', 'OFFEN'].includes(parseRequiredString(productionPath) ?? '')) addError(errors, 'production_path', 'Required')
  } else if (copyShopType !== 'POSTER' && copyShopType !== 'PRINTOUT' && copyShopType !== 'BUSINESS_CARD' && copyShopType !== 'BINDING') {
    if (productionPath != null && productionPath !== '' && productionPath !== 'COPYSHOP' && productionPath !== 'OFFSET') addError(errors, 'production_path', 'Invalid')
  }

  if (copyShopType === 'POSTER') {
    const posterFormat = parseRequiredString(fields.format)
    if (!['A4', 'A3', 'A2', 'A1', 'A0', 'FREI'].includes(posterFormat ?? '')) addError(errors, 'format', 'Required')
    if (!['120G_AFFICHEN', '200G_SEIDENGLANZ', '200G_GLANZ'].includes(parseRequiredString(fields.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(fields.laminate) ?? '')) addError(errors, 'laminate', 'Required')
    if (posterFormat === 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
    else if (posterFormat && posterFormat !== 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (copyShopType === 'CARD_FLYER') {
    if (!['1_0', '1_1', '4_0', '4_4'].includes(parseRequiredString(fields.color_mode) ?? '')) addError(errors, 'color_mode', 'Required')
    validateCardFoldFormat(false, fields, errors)
    if (requireBoolPresent(fields.full_bleed) === 'missing') addError(errors, 'full_bleed', 'Required')
    const productionPathStr = parseRequiredString(productionPath)
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(fields, errors, 'cc_material', 'cc_material_other')
    } else if (productionPathStr === 'OFFSET') {
      validateOffsetMaterial(fields, errors)
    }
  } else if (copyShopType === 'FOLDED_FLYER') {
    if (!['1_1', '4_4'].includes(parseRequiredString(fields.color_mode) ?? '')) addError(errors, 'color_mode', 'Required')
    if (!['MITTELFALZ', 'WICKELFALZ', 'ZICKZACK'].includes(parseRequiredString(fields.fold_type) ?? '')) addError(errors, 'fold_type', 'Required')
    validateCardFoldFormat(true, fields, errors)
    validateFoldPageCount(fields, errors)
    if (requireBoolPresent(fields.full_bleed) === 'missing') addError(errors, 'full_bleed', 'Required')
    const productionPathStr = parseRequiredString(productionPath)
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(fields, errors, 'cc_material', 'cc_material_other')
    } else if (productionPathStr === 'OFFSET') {
      validateOffsetMaterial(fields, errors)
    }
  } else if (copyShopType === 'BROCHURE') {
    validateBrochureFormat(fields, errors)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(parseRequiredString(fields.orientation) ?? '')) {
      addError(errors, 'orientation', 'Required')
    }
    validateBrochurePageCount(fields, errors)
    const productionPathStr = parseRequiredString(productionPath)
    const orientation = parseRequiredString(fields.orientation)
    if (orientation === 'QUERFORMAT' && productionPathStr === 'CC') {
      addError(errors, 'brochure_landscape_cc', 'Landscape only for Offset or Open')
    }
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(fields, errors, 'cover_material', 'cover_material_other')
      validateCcMaterialPair(fields, errors, 'inner_material', 'inner_material_other')
    } else if (productionPathStr === 'OFFSET' || productionPathStr === 'OFFEN') {
      validateBrochureOffsetOrOpen(fields, errors)
    }
    if (requireBoolPresent(fields.full_bleed) === 'missing') addError(errors, 'full_bleed', 'Required')
  } else if (copyShopType === 'BUSINESS_CARD') {
    const material = parseRequiredString(fields.material)
    const visitMat = [
      '300G_CC',
      '350G_OFFSET',
      '400G_OFFSET',
      '300G_RECYCLING',
      '250G_LEINENSTRUKTUR',
      'MULTILOFT',
    ]
    if (!material || !visitMat.includes(material)) addError(errors, 'material', 'Required')
    if (!['4_0', '4_4'].includes(parseRequiredString(fields.color_mode) ?? '')) addError(errors, 'color_mode', 'Required')
    const format = parseRequiredString(fields.format)
    if (!['STANDARD_85_55', 'STANDARD_90_50', 'FREI'].includes(format ?? '')) addError(errors, 'format', 'Required')
    if (format === 'FREI' && !hasDimension(fields.width, fields.height)) addError(errors, 'format_masse', MSG_MASSE)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(parseRequiredString(fields.orientation) ?? '')) {
      addError(errors, 'orientation', 'Required')
    }
    if (material === '350G_OFFSET' && requireBoolPresent(fields.film_laminated) === 'missing') {
      addError(errors, 'film_laminated', 'Required')
    }
    if (material === 'MULTILOFT') {
      const multiloftColors = [
        'SCHWARZ',
        'ELFENBEIN',
        'WEISS',
        'ROT',
        'OLIVGRUEN',
        'HELLGRUEN',
        'TUERKIS',
        'LILA',
        'GELB',
        'ORANGE',
        'MAGENTA',
        'ROSA',
        'BLAU',
      ]
      if (!multiloftColors.includes(parseRequiredString(fields.multiloft_color) ?? '')) addError(errors, 'multiloft_color', 'Required')
    }
    if (requireBoolPresent(fields.full_bleed) === 'missing') addError(errors, 'full_bleed', 'Required')
  } else if (copyShopType === 'BINDING') {
    const material = parseRequiredString(fields.material)
    if (!['80G', '100G', '120G', 'SONSTIGE'].includes(material ?? '')) addError(errors, 'material', 'Required')
    if (material === 'SONSTIGE' && !parseRequiredString(fields.material_other)) addError(errors, 'material_other', 'Required')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(parseRequiredString(fields.color_mode) ?? '')) addError(errors, 'color_mode', 'Required')
    const bindingType = parseRequiredString(fields.binding_type) as 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | null
    if (!['WIRE_O', 'KUNSTSTOFFSPIRALE', 'SOFTCOVER', 'HARDCOVER'].includes(bindingType ?? '')) addError(errors, 'binding_type', 'Required')
    const bindingColor = parseRequiredString(fields.binding_color)
    if (!bindingType || !bindingColor || !isBindingColorValid(bindingType, bindingColor)) addError(errors, 'binding_color', 'Required')
    if (bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE') {
      const wireFormat = parseRequiredString(fields.format)
      if (!['A5', 'A4', 'A3', 'FREI'].includes(wireFormat ?? '')) addError(errors, 'format', 'Required')
      const orientation = parseRequiredString(fields.orientation)
      if (wireFormat === 'A5' || wireFormat === 'A4') {
        if (!['HOCHFORMAT', 'QUERFORMAT'].includes(orientation ?? '')) addError(errors, 'orientation', 'Required')
      }
      if (wireFormat === 'A3' && orientation !== 'QUERFORMAT') addError(errors, 'orientation', 'A3 nur Querformat')
      if (wireFormat === 'FREI') {
        const height = parseMmDimension(fields.height)
        if (height != null && height > 300) addError(errors, 'height', 'Height max. 300 mm (binding edge)')
      }
    } else if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
      if (parseRequiredString(fields.format) !== 'A4') addError(errors, 'format', 'A4 Hochformat 210×297 mm')
      else if (parseRequiredString(fields.orientation) !== 'HOCHFORMAT') {
        addError(errors, 'orientation', 'Required')
      } else {
        const width = parseMmDimension(fields.width)
        const height = parseMmDimension(fields.height)
        if (width == null || height == null || Math.abs(width - 210) > 0.5 || Math.abs(height - 297) > 0.5) {
          addError(errors, 'format', 'A4 Hochformat 210×297 mm')
        }
      }
    }
    if (bindingType === 'HARDCOVER') {
      if (requireBoolPresent(fields.hardcover_print) === 'missing') addError(errors, 'hardcover_print', 'Required')
      if (fields.hardcover_print === true && !parseRequiredString(fields.hardcover_cover)) {
        addError(errors, 'hardcover_cover', 'Required')
      }
    }
    if (requireBoolPresent(fields.full_bleed) === 'missing') addError(errors, 'full_bleed', 'Required')
  } else if (copyShopType === 'PRINTOUT') {
    if (!['A5', 'A4', 'A3'].includes(parseRequiredString(fields.format) ?? '')) addError(errors, 'format', 'Required')
    const material = parseRequiredString(fields.material)
    if (!['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'].includes(material ?? '')) addError(errors, 'material', 'Required')
    if (material === 'SONSTIGE' && !parseRequiredString(fields.material_other)) addError(errors, 'material_other', 'Required')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(parseRequiredString(fields.color_mode) ?? '')) addError(errors, 'color_mode', 'Required')
    if (!['NEIN', '2_LOCH', '4_LOCH'].includes(parseRequiredString(fields.punching) ?? '')) addError(errors, 'punching', 'Required')
    if (requireBoolPresent(fields.staple) === 'missing') addError(errors, 'staple', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(fields.laminate) ?? '')) addError(errors, 'laminate', 'Required')
  }
  return errors
}
