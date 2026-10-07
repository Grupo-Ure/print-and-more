/**
 * Per-product-type schema registry + the single validation entry point.
 *
 * `SCHEMA_BY_TYPE` covers every product type — the 30 keys of
 * `CHILD_TABLE_BY_TYPE` plus `TEXTILE_GARMENT`, whose batch has no single child
 * table. `validateProduct` returns a `Record<string, field-key → message>`,
 * the contract the per-type forms consume.
 */

import type { z } from 'zod'
import { zodIssuesToFieldMap } from './zodErrors'

import {
  posterSchema,
  cardFlyerSchema,
  foldedFlyerSchema,
  brochureSchema,
  businessCardSchema,
  bindingSchema,
  printoutSchema,
} from './schemas/copyshop'
import {
  trodatPrintySchema,
  woodenStampSchema,
  standStampSchema,
  dateStampSchema,
  otherStampSchema,
  stampPlateSchema,
  refillInkSchema,
  inkPadSchema,
  trodatPadSchema,
} from './schemas/stamp'
import {
  stickerSchema,
  signUvSchema,
  signFoilSchema,
  foilPlotterSchema,
  bannerSchema,
  rollupSchema,
  vehicleLetteringSchema,
  otherLfpSchema,
} from './schemas/lfp'
import {
  signSchema,
  trophyPlateSchema,
  nameTagSchema,
  giftItemSchema,
  otherLaserSchema,
} from './schemas/laser'
import { otherSchema } from './schemas/other'
import { textileGarmentSchema } from './schemas/textile'

/** type discriminator → its Zod schema. Keys mirror `CHILD_TABLE_BY_TYPE`. */
export const SCHEMA_BY_TYPE: Record<string, z.ZodTypeAny> = {
  // CopyShop
  POSTER: posterSchema,
  CARD_FLYER: cardFlyerSchema,
  FOLDED_FLYER: foldedFlyerSchema,
  BROCHURE: brochureSchema,
  BUSINESS_CARD: businessCardSchema,
  BINDING: bindingSchema,
  PRINTOUT: printoutSchema,
  // Stamp
  TRODAT_PRINTY: trodatPrintySchema,
  WOODEN_STAMP: woodenStampSchema,
  STAND_STAMP: standStampSchema,
  DATE_STAMP: dateStampSchema,
  OTHER_STAMP: otherStampSchema,
  STAMP_PLATE: stampPlateSchema,
  REFILL_INK: refillInkSchema,
  INK_PAD: inkPadSchema,
  TRODAT_PAD: trodatPadSchema,
  // LFP
  STICKER: stickerSchema,
  SIGN_UV: signUvSchema,
  SIGN_FOIL: signFoilSchema,
  FOIL_PLOTTER: foilPlotterSchema,
  BANNER: bannerSchema,
  ROLLUP: rollupSchema,
  VEHICLE_LETTERING: vehicleLetteringSchema,
  OTHER_LFP: otherLfpSchema,
  // Laser
  SIGN: signSchema,
  TROPHY_PLATE: trophyPlateSchema,
  NAME_TAG: nameTagSchema,
  GIFT_ITEM: giftItemSchema,
  OTHER_LASER: otherLaserSchema,
  // Other
  OTHER: otherSchema,
  // Textile
  TEXTILE_GARMENT: textileGarmentSchema,
}

/**
 * Validate a product's flat fields (child columns + parent `quantity`) for its
 * `type`.
 *
 * - missing / unknown type → `{ type: 'Select type' }`.
 * - otherwise the type's schema runs; issues are mapped to `field-key → message`.
 *
 * The order's status plays no part: a product of a chosen type carries that
 * type's required fields whether or not the order is still a quote.
 */
export function validateProduct(
  type: string | null,
  fields: unknown,
): Record<string, string> {
  if (!type || !(type in SCHEMA_BY_TYPE)) return { type: 'Select type' }
  const result = SCHEMA_BY_TYPE[type].safeParse(fields)
  return result.success ? {} : zodIssuesToFieldMap(result.error)
}
