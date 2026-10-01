/**
 * The product catalog of the UI: which types a department offers, and which
 * form edits each of them.
 *
 * Under the job model each department had a section component that owned this
 * mapping plus a product table. With the product as the unit of work both
 * hosts need the mapping and neither needs a table, so it lives here once:
 * {@link PRODUCT_TYPES_BY_DEPARTMENT} drives the add dialog's type picker,
 * {@link productFormForType} resolves the form the Basic info tab renders.
 */

import type { ComponentType } from 'react'
import { COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS } from '../../types/copyshop'
import { LASER_TYPES, LASER_TYPE_LABELS } from '../../types/laser'
import { LFP_TYPES, LFP_TYPE_LABELS } from '../../types/lfp'
import { DEPARTMENTS, type Department } from '../../types/database'
import { STAMP_ALL_LABELS, STAMP_ALL_TYPES } from './forms/stampTypes'
import { TEXTILE_ALL_LABELS, TEXTILE_ALL_TYPES } from './forms/textileTypes'
import type { ProductFormProps } from './forms/shared'
import {
  PosterForm,
  CardFlyerForm,
  FoldedFlyerForm,
  BrochureForm,
  BusinessCardForm,
  BindingForm,
  PrintoutForm,
} from './forms/copyshop'
import {
  TrodatPrintyForm,
  WoodenStampForm,
  StandStampForm,
  DateStampForm,
  OtherStampForm,
  StampPlateForm,
  RefillInkForm,
  InkPadForm,
  TrodatPadForm,
} from './forms/stamp'
import {
  StickerForm,
  SignUvForm,
  SignFoilForm,
  FoilPlotterForm,
  BannerForm,
  RollupForm,
  VehicleLetteringForm,
  OtherLfpForm,
} from './forms/lfp'
import {
  SignForm,
  TrophyPlateForm,
  NameTagForm,
  GiftItemForm,
  OtherLaserForm,
} from './forms/laser'
import { OtherForm } from './forms/other'
import { TextileBatchForm } from './forms/textile'

export type ProductTypeOption = { value: string; label: string }

const options = (
  types: readonly string[],
  labels: Record<string, string>,
): ProductTypeOption[] => types.map(type => ({ value: type, label: labels[type] ?? type }))

/** The types a department's add dialog offers, in picker order. */
export const PRODUCT_TYPES_BY_DEPARTMENT: Record<Department, ProductTypeOption[]> = {
  COPYSHOP: options(COPY_SHOP_TYPES, COPY_SHOP_TYPE_LABELS),
  STAMP: options(STAMP_ALL_TYPES, STAMP_ALL_LABELS),
  LFP: options(LFP_TYPES, LFP_TYPE_LABELS),
  LASER_ENGRAVING: options(LASER_TYPES, LASER_TYPE_LABELS),
  TEXTILE: options(TEXTILE_ALL_TYPES, TEXTILE_ALL_LABELS),
  OTHER: [{ value: 'OTHER', label: 'Other' }],
}

/** Every type's label, whatever its department (history sentences, row titles). */
export const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.flatMap(department =>
    PRODUCT_TYPES_BY_DEPARTMENT[department].map(option => [option.value, option.label]),
  ),
)

/**
 * The form component of a product type — textile's is the batch editor. Indexed
 * directly by the hosts (`FORM_BY_TYPE[type]`) rather than wrapped in a lookup
 * function: a component resolved through a call reads as one created during
 * render, which React's lint rules rightly refuse.
 */
export const FORM_BY_TYPE: Record<string, ComponentType<ProductFormProps> | undefined> = {
  // CopyShop
  POSTER: PosterForm,
  CARD_FLYER: CardFlyerForm,
  FOLDED_FLYER: FoldedFlyerForm,
  BROCHURE: BrochureForm,
  BUSINESS_CARD: BusinessCardForm,
  BINDING: BindingForm,
  PRINTOUT: PrintoutForm,
  // Stamp
  TRODAT_PRINTY: TrodatPrintyForm,
  WOODEN_STAMP: WoodenStampForm,
  STAND_STAMP: StandStampForm,
  DATE_STAMP: DateStampForm,
  OTHER_STAMP: OtherStampForm,
  STAMP_PLATE: StampPlateForm,
  REFILL_INK: RefillInkForm,
  INK_PAD: InkPadForm,
  TRODAT_PAD: TrodatPadForm,
  // LFP
  STICKER: StickerForm,
  SIGN_UV: SignUvForm,
  SIGN_FOIL: SignFoilForm,
  FOIL_PLOTTER: FoilPlotterForm,
  BANNER: BannerForm,
  ROLLUP: RollupForm,
  VEHICLE_LETTERING: VehicleLetteringForm,
  OTHER_LFP: OtherLfpForm,
  // Laser
  SIGN: SignForm,
  TROPHY_PLATE: TrophyPlateForm,
  NAME_TAG: NameTagForm,
  GIFT_ITEM: GiftItemForm,
  OTHER_LASER: OtherLaserForm,
  // Other
  OTHER: OtherForm,
  // Textile — the batch
  TEXTILE_GARMENT: TextileBatchForm,
}
