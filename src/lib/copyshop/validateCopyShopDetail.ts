/**
 * Validation for CopyShop sub-order detail.
 *
 * Each CopyShop `typ` (poster, card/flyer, folded flyer, brochure,
 * business card, binding, ad-hoc print) has its own required fields
 * inside the `detail` JSONB column. {@link validateCopyShopDetail}
 * returns a map of field-key → German error message (rendered inline
 * next to the form field). An empty map means the detail is valid.
 *
 * The validator handles two production paths (Copy-Center vs offset)
 * with different material and format rules. In `ANGEBOT` (quote stage)
 * nothing is required regardless of typ.
 */

import { COPY_SHOP_TYPES, type CopyShopDetailJson, type CopyShopType } from '../../types/copyshop'
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
const addError = (errors: Err, field: string, message: string) => {
  errors[field] = message
}

const CC_G = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'] as const

function validateCcMaterialPair(detail: CopyShopDetailJson, errors: Err, materialKey: string, sonstigeKey: string) {
  const material = parseRequiredString((detail as Record<string, unknown>)[materialKey] as string)
  if (!material || !(CC_G as readonly string[]).includes(material)) addError(errors, materialKey, 'Required')
  if (material === 'SONSTIGE' && !parseRequiredString((detail as Record<string, unknown>)[sonstigeKey] as string)) addError(errors, sonstigeKey, 'Required')
}

function validateCardFoldFormat(isFolded: boolean, detail: CopyShopDetailJson, errors: Err) {
  const format = parseRequiredString((detail as Record<string, string>).format)
  const validCardFormats = [
    'DIN_LANG',
    'A7',
    'A6',
    'A5',
    'A4',
    'A3',
    'FREI',
  ]
  const validFoldFormats = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'FREI']
  if (isFolded) {
    if (!validFoldFormats.includes(format ?? '')) addError(errors, 'format', 'Required')
  } else {
    if (!validCardFormats.includes(format ?? '')) addError(errors, 'format', 'Required')
  }
  if (format === 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  else if (format && format !== 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
}

function validateOffsetMaterial(detail: CopyShopDetailJson, errors: Err) {
  const offsetType = parseRequiredString((detail as Record<string, string>).offset_art)
  if (!['STANDARD', 'OFFSET', 'SPEZIAL'].includes(offsetType ?? '')) addError(errors, 'offset_art', 'Required')
  if (offsetType === 'STANDARD') {
    if (!['115G', '135G', '170G', '250G', '300G', '350G', '400G'].includes(parseRequiredString((detail as Record<string, string>).offset_grammatur) ?? '')) {
      addError(errors, 'offset_grammatur', 'Required')
    }
    if (!['MATT', 'GLAENZEND'].includes(parseRequiredString((detail as Record<string, string>).offset_oberflaeche) ?? '')) {
      addError(errors, 'offset_oberflaeche', 'Required')
    }
  } else if (offsetType === 'OFFSET') {
    if (!['80G', '90G', '100G', '120G', '150G', '250G'].includes(parseRequiredString((detail as Record<string, string>).offset_grammatur) ?? '')) {
      addError(errors, 'offset_grammatur', 'Required')
    }
  } else if (offsetType === 'SPEZIAL') {
    const specialPaper = parseRequiredString((detail as Record<string, string>).spezial_papier)
    if (!['300G_FOLIENKASCHIERT', 'RECYCLING', '250G_LEINENSTRUKTUR', 'SONSTIGE'].includes(specialPaper ?? '')) {
      addError(errors, 'spezial_papier', 'Required')
    } else if (specialPaper === '300G_FOLIENKASCHIERT') {
      if (!['MATT', 'GLAENZEND'].includes(parseRequiredString((detail as Record<string, string>).kaschierung) ?? '')) addError(errors, 'kaschierung', 'Required')
      if (!['EINSEITIG', 'BEIDSEITIG'].includes(parseRequiredString((detail as Record<string, string>).kaschierung_seiten) ?? '')) {
        addError(errors, 'kaschierung_seiten', 'Required')
      }
    } else if (specialPaper === 'RECYCLING') {
      if (!['80G', '135G', '150G', '300G'].includes(parseRequiredString((detail as Record<string, string>).recycling_grammatur) ?? '')) {
        addError(errors, 'recycling_grammatur', 'Required')
      }
    } else if (specialPaper === 'SONSTIGE') {
      if (!parseRequiredString((detail as Record<string, string>).spezial_sonstige)) addError(errors, 'spezial_sonstige', 'Required')
    }
  }
}

function validateBrochureOffsetOrOpen(detail: CopyShopDetailJson, errors: Err) {
  if (
    !['DRAHTHEFTUNG', 'RINGSÖSEN', 'KLEBEBINDUNG', 'SPIRALBINDUNG'].includes(
      parseRequiredString((detail as Record<string, string>).brosch_bindung) ?? '',
    )
  ) {
    addError(errors, 'brosch_bindung', 'Required')
  }
  if (!['135G', '170G', '250G', '300G'].includes(parseRequiredString((detail as Record<string, string>).brosch_u_gramm) ?? '')) {
    addError(errors, 'brosch_u_gramm', 'Required')
  }
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString((detail as Record<string, string>).brosch_u_ober) ?? '')) {
    addError(errors, 'brosch_u_ober', 'Required')
  }
  if (!['90G', '135G', '170G'].includes(parseRequiredString((detail as Record<string, string>).brosch_i_gramm) ?? '')) {
    addError(errors, 'brosch_i_gramm', 'Required')
  }
  if (!['MATT', 'GLAENZEND'].includes(parseRequiredString((detail as Record<string, string>).brosch_i_ober) ?? '')) {
    addError(errors, 'brosch_i_ober', 'Required')
  }
}

function validateFoldPageCount(detail: CopyShopDetailJson, errors: Err) {
  const pageCount = parseIntWithMin(detail.seitenzahl, 2)
  if (pageCount == null) addError(errors, 'seitenzahl', 'Required')
  else if (pageCount > 100) addError(errors, 'seitenzahl', 'Max. 100')
  else if (pageCount % 2 !== 0) addError(errors, 'seitenzahl', 'Even numbers only (2–100)')
}

function validateBrochurePageCount(detail: CopyShopDetailJson, errors: Err) {
  const pageCount = parseIntWithMin(detail.seitenzahl, 4)
  if (pageCount == null) addError(errors, 'seitenzahl', 'Required')
  else if (pageCount > 152) addError(errors, 'seitenzahl', 'Max. 152')
  else if (pageCount % 4 !== 0) addError(errors, 'seitenzahl', 'Page count must be divisible by 4')
}

function validateBrochureFormat(detail: CopyShopDetailJson, errors: Err) {
  const format = parseRequiredString((detail as Record<string, string>).format)
  if (!['A6', 'A5', 'A4', 'FREI'].includes(format ?? '')) addError(errors, 'format', 'Required')
  if (format === 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  else if (format && format !== 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
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
 * Validate a CopyShop sub-order's typ + detail against its current status.
 *
 * Returns a map of field-key → German error message; empty map means
 * valid. In `ANGEBOT` no fields are required. Otherwise the typ must be
 * one of {@link COPY_SHOP_TYPES}, `stueckzahl` must be a positive integer,
 * and the typ-specific keys (production path, format, material, paper
 * weight, finishing options, etc.) must be set.
 */
export function validateCopyShopDetail(
  typ: string | null,
  detail: CopyShopDetailJson,
  subOrderStatus: OrderStatus,
): Record<string, string> {
  const errors: Err = {}
  if (subOrderStatus === 'QUOTE') return errors
  if (!typ || !COPY_SHOP_TYPES.includes(typ as CopyShopType)) {
    addError(errors, 'typ', 'Select type')
    return errors
  }
  if (!isValidQuantity(detail.stueckzahl)) addError(errors, 'stueckzahl', 'Integer ≥ 1')
  const copyShopType = typ as CopyShopType
  const productionPath = detail.produktionsweg
  if (copyShopType === 'KARTE_FLYER' || copyShopType === 'FALZFLYER' || copyShopType === 'BROSCHUERE') {
    if (!['CC', 'OFFSET', 'OFFEN'].includes(parseRequiredString(productionPath) ?? '')) addError(errors, 'produktionsweg', 'Required')
  } else if (copyShopType !== 'PLAKAT_POSTER' && copyShopType !== 'AUSDRUCK' && copyShopType !== 'VISITENKARTE' && copyShopType !== 'BINDUNG') {
    if (productionPath != null && productionPath !== '' && productionPath !== 'COPYSHOP' && productionPath !== 'OFFSET') addError(errors, 'produktionsweg', 'Invalid')
  }

  if (copyShopType === 'PLAKAT_POSTER') {
    const posterFormat = parseRequiredString((detail as Record<string, string>).format)
    if (!['A4', 'A3', 'A2', 'A1', 'A0', 'FREI'].includes(posterFormat ?? '')) addError(errors, 'format', 'Required')
    if (!['120G_AFFICHEN', '200G_SEIDENGLANZ', '200G_GLANZ'].includes(parseRequiredString(detail.material) ?? '')) addError(errors, 'material', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminat) ?? '')) addError(errors, 'laminat', 'Required')
    if (posterFormat === 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
    else if (posterFormat && posterFormat !== 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
  } else if (copyShopType === 'KARTE_FLYER') {
    if (!['1_0', '1_1', '4_0', '4_4'].includes(parseRequiredString(detail.farbigkeit) ?? '')) addError(errors, 'farbigkeit', 'Required')
    validateCardFoldFormat(false, detail, errors)
    if (requireBoolPresent(detail.randabfallend) === 'missing') addError(errors, 'randabfallend', 'Required')
    const productionPathStr = parseRequiredString(productionPath)
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(detail, errors, 'material_cc', 'material_cc_sonstige')
    } else if (productionPathStr === 'OFFSET') {
      validateOffsetMaterial(detail, errors)
    }
  } else if (copyShopType === 'FALZFLYER') {
    if (!['1_1', '4_4'].includes(parseRequiredString(detail.farbigkeit) ?? '')) addError(errors, 'farbigkeit', 'Required')
    if (!['MITTELFALZ', 'WICKELFALZ', 'ZICKZACK'].includes(parseRequiredString(detail.falzart) ?? '')) addError(errors, 'falzart', 'Required')
    validateCardFoldFormat(true, detail, errors)
    validateFoldPageCount(detail, errors)
    if (requireBoolPresent(detail.randabfallend) === 'missing') addError(errors, 'randabfallend', 'Required')
    const productionPathStr = parseRequiredString(productionPath)
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(detail, errors, 'material_cc', 'material_cc_sonstige')
    } else if (productionPathStr === 'OFFSET') {
      validateOffsetMaterial(detail, errors)
    }
  } else if (copyShopType === 'BROSCHUERE') {
    validateBrochureFormat(detail, errors)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(parseRequiredString((detail as Record<string, string>).orientierung) ?? '')) {
      addError(errors, 'orientierung', 'Required')
    }
    validateBrochurePageCount(detail, errors)
    const productionPathStr = parseRequiredString(productionPath)
    const orientation = parseRequiredString((detail as Record<string, string>).orientierung)
    if (orientation === 'QUERFORMAT' && productionPathStr === 'CC') {
      addError(errors, 'brosch_quer_cc', 'Landscape only for Offset or Open')
    }
    if (productionPathStr === 'CC') {
      validateCcMaterialPair(detail, errors, 'cc_umschlag', 'cc_umschlag_sonstige')
      validateCcMaterialPair(detail, errors, 'cc_inhalt', 'cc_inhalt_sonstige')
    } else if (productionPathStr === 'OFFSET' || productionPathStr === 'OFFEN') {
      validateBrochureOffsetOrOpen(detail, errors)
    }
    if (requireBoolPresent(detail.randabfallend) === 'missing') addError(errors, 'randabfallend', 'Required')
  } else if (copyShopType === 'VISITENKARTE') {
    const material = parseRequiredString((detail as Record<string, string>).material)
    const visitMat = [
      '300G_CC',
      '350G_OFFSET',
      '400G_OFFSET',
      '300G_RECYCLING',
      '250G_LEINENSTRUKTUR',
      'MULTILOFT',
    ]
    if (!material || !visitMat.includes(material)) addError(errors, 'material', 'Required')
    if (!['4_0', '4_4'].includes(parseRequiredString(detail.farbigkeit) ?? '')) addError(errors, 'farbigkeit', 'Required')
    const format = parseRequiredString((detail as Record<string, string>).format)
    if (!['STANDARD_85_55', 'STANDARD_90_50', 'FREI'].includes(format ?? '')) addError(errors, 'format', 'Required')
    if (format === 'FREI' && !hasDimension(detail.format_breite, detail.format_hoehe)) addError(errors, 'format_masse', MSG_MASSE)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(parseRequiredString((detail as Record<string, string>).orientierung) ?? '')) {
      addError(errors, 'orientierung', 'Required')
    }
    if (material === '350G_OFFSET' && requireBoolPresent((detail as Record<string, unknown>).folienkaschiert) === 'missing') {
      addError(errors, 'folienkaschiert', 'Required')
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
      if (!multiloftColors.includes(parseRequiredString((detail as Record<string, string>).multiloft_farbkern) ?? '')) addError(errors, 'multiloft_farbkern', 'Required')
    }
    if (requireBoolPresent(detail.randabfallend) === 'missing') addError(errors, 'randabfallend', 'Required')
  } else if (copyShopType === 'BINDUNG') {
    const material = parseRequiredString((detail as Record<string, string>).material)
    if (!['80G', '100G', '120G', 'SONSTIGE'].includes(material ?? '')) addError(errors, 'material', 'Required')
    if (material === 'SONSTIGE' && !parseRequiredString((detail as Record<string, string>).material_sonstige)) addError(errors, 'material_sonstige', 'Required')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(parseRequiredString(detail.farbigkeit) ?? '')) addError(errors, 'farbigkeit', 'Required')
    const bindingType = parseRequiredString(detail.bindungsart) as 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | null
    if (!['WIRE_O', 'KUNSTSTOFFSPIRALE', 'SOFTCOVER', 'HARDCOVER'].includes(bindingType ?? '')) addError(errors, 'bindungsart', 'Required')
    const bindingColor = parseRequiredString(detail.bindungsart_farbe)
    if (!bindingType || !bindingColor || !isBindingColorValid(bindingType, bindingColor)) addError(errors, 'bindungsart_farbe', 'Required')
    if (bindingType === 'WIRE_O' || bindingType === 'KUNSTSTOFFSPIRALE') {
      const wireFormat = parseRequiredString((detail as Record<string, string>).format)
      if (!['A5', 'A4', 'A3', 'FREI'].includes(wireFormat ?? '')) addError(errors, 'format', 'Required')
      const orientation = parseRequiredString((detail as Record<string, string>).orientierung)
      if (wireFormat === 'A5' || wireFormat === 'A4') {
        if (!['HOCHFORMAT', 'QUERFORMAT'].includes(orientation ?? '')) addError(errors, 'orientierung', 'Required')
      }
      if (wireFormat === 'A3' && orientation !== 'QUERFORMAT') addError(errors, 'orientierung', 'A3 nur Querformat')
      if (wireFormat === 'FREI') {
        const height = parseMmDimension(detail.format_hoehe)
        if (height != null && height > 300) addError(errors, 'format_hoehe', 'Height max. 300 mm (binding edge)')
      }
    } else if (bindingType === 'SOFTCOVER' || bindingType === 'HARDCOVER') {
      if (parseRequiredString((detail as Record<string, string>).format) !== 'A4') addError(errors, 'format', 'A4 Hochformat 210×297 mm')
      else if (parseRequiredString((detail as Record<string, string>).orientierung) !== 'HOCHFORMAT') {
        addError(errors, 'orientierung', 'Required')
      } else {
        const width = parseMmDimension(detail.format_breite)
        const height = parseMmDimension(detail.format_hoehe)
        if (width == null || height == null || Math.abs(width - 210) > 0.5 || Math.abs(height - 297) > 0.5) {
          addError(errors, 'format', 'A4 Hochformat 210×297 mm')
        }
      }
    }
    if (bindingType === 'HARDCOVER') {
      if (requireBoolPresent((detail as Record<string, unknown>).hardcover_druck) === 'missing') addError(errors, 'hardcover_druck', 'Required')
      if (detail.hardcover_druck === true && !parseRequiredString((detail as Record<string, string>).hardcover_einband)) {
        addError(errors, 'hardcover_einband', 'Required')
      }
    }
    if (requireBoolPresent(detail.randabfallend) === 'missing') addError(errors, 'randabfallend', 'Required')
  } else if (copyShopType === 'AUSDRUCK') {
    if (!['A5', 'A4', 'A3'].includes(parseRequiredString((detail as Record<string, string>).format) ?? '')) addError(errors, 'format', 'Required')
    const material = parseRequiredString((detail as Record<string, string>).material)
    if (!['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'].includes(material ?? '')) addError(errors, 'material', 'Required')
    if (material === 'SONSTIGE' && !parseRequiredString((detail as Record<string, string>).material_sonstige)) addError(errors, 'material_sonstige', 'Required')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(parseRequiredString(detail.farbigkeit) ?? '')) addError(errors, 'farbigkeit', 'Required')
    if (!['NEIN', '2_LOCH', '4_LOCH'].includes(parseRequiredString(detail.lochen) ?? '')) addError(errors, 'lochen', 'Required')
    if (requireBoolPresent(detail.heften) === 'missing') addError(errors, 'heften', 'Required')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(parseRequiredString(detail.laminieren) ?? '')) addError(errors, 'laminieren', 'Required')
  }
  return errors
}
