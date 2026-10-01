/**
 * Which form edits each product type.
 *
 * Under the job model each department had a section component that owned this
 * mapping plus a product table. With the product as the unit of work both hosts
 * — the add dialog and the Basic info tab — need the mapping and neither needs a
 * table, so it lives here once. The types each department offers and their
 * labels are display data shared with the PDF sheet, so they sit in
 * `const/productTypes.ts`.
 */

import type { ComponentType } from 'react'
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
