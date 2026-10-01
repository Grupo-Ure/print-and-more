/**
 * Type definitions for the LFP (Large Format Print) department.
 *
 * LFP covers everything printed on a wide-format printer or vinyl plotter:
 * stickers (Aufkleber), UV-printed rigid signs (Schild UV), foil-laminated
 * signs (Schild Folie), vinyl plotting (Folienplott), banners, rollups,
 * vehicle wraps (Fahrzeugbeschriftung), and miscellaneous large-format
 * work (Sonstige LFP).
 *
 * Each type's spec columns live in its own child table; the per-type field
 * requirements are the Zod schemas in `src/lib/products/schemas/lfp.ts`.
 */

/** Discriminator for the kind of LFP work, stored in `products.type`. */
export type LfpType =
  | 'STICKER'
  | 'SIGN_UV'
  | 'SIGN_FOIL'
  | 'FOIL_PLOTTER'
  | 'BANNER'
  | 'ROLLUP'
  | 'VEHICLE_LETTERING'
  | 'OTHER_LFP'

/** All LFP types in the order they appear in dropdowns. */
export const LFP_TYPES: LfpType[] = [
  'STICKER',
  'SIGN_UV',
  'SIGN_FOIL',
  'FOIL_PLOTTER',
  'BANNER',
  'ROLLUP',
  'VEHICLE_LETTERING',
  'OTHER_LFP',
]

/** Display labels for {@link LfpType}, rendered in tabs and dropdowns. */
export const LFP_TYPE_LABELS: Record<LfpType, string> = {
  STICKER: 'Sticker',
  SIGN_UV: 'Sign (UV)',
  SIGN_FOIL: 'Sign (Foil)',
  FOIL_PLOTTER: 'Vinyl Plot',
  BANNER: 'Banner',
  ROLLUP: 'Roll-up',
  VEHICLE_LETTERING: 'Vehicle Wrap',
  OTHER_LFP: 'Other (LFP)',
}
