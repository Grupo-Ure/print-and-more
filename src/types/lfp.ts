/**
 * Type definitions for the LFP (Large Format Print) department.
 *
 * LFP covers everything printed on a wide-format printer or vinyl plotter:
 * stickers (Aufkleber), UV-printed rigid signs (Schild UV), foil-laminated
 * signs (Schild Folie), vinyl plotting (Folienplott), banners, rollups,
 * vehicle wraps (Fahrzeugbeschriftung), and miscellaneous large-format
 * jobs (Sonstige LFP).
 *
 * The shape of an LFP sub-order's `detail` JSONB column varies by `typ`.
 * See {@link validateLfpDetail} in `src/lib/lfp/` for the per-typ field
 * requirements.
 */

/** Discriminator for the kind of LFP work, stored in `teilauftraege.typ`. */
export type LfpType =
  | 'STICKER'
  | 'SIGN_UV'
  | 'SIGN_FOIL'
  | 'FOIL_PLOTTER'
  | 'BANNER'
  | 'ROLLUP'
  | 'VEHICLE_LETTERING'
  | 'OTHER_LFP'

/** All LFP typen in the order they appear in dropdowns. */
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

/**
 * Shape of the JSONB `detail` column for an LFP sub-order.
 *
 * The set of keys present depends on the sub-order's `typ` — only set
 * keys relevant to the current typ. See `validateLfpDetail` for the
 * per-typ field set and validation rules.
 */
export type LfpDetail = Record<string, unknown>
