import type { Department } from '../../src/types/database'
import type { Json } from '../../src/types/supabase'
import type { ProductChildSeed, TextileBatchSeed } from '../support/database'
import { IN_STOCK_STAMP_MODEL } from './stamps'
import { IN_STOCK_TEXTILE_CHAIN } from './textiles'

/**
 * One product of every type, as `save_product` takes it for a create: the
 * parent's spec columns and the rows of its children, the way the app maps
 * them from the type's form. Each holds values its type's form can produce,
 * so what is read back is a spec the app could have saved.
 *
 * The stored values are the German enum strings the spec columns still hold
 * (e.g. `'NEIN'`, `'HOCHFORMAT'`); see CLAUDE.md, "Known remaining German".
 */

/** The parent's spec columns of a product to save. */
type ProductSaveParent = {
  department: Department
  type: string
  /** Null for a textile batch, whose pieces are counted on its garment lines. */
  quantity: number | null
}

/** A product whose type has one typed child row. */
export type SingleChildSave = ProductSaveParent & ProductChildSeed

/** A textile batch: garment lines and designs in place of one child row. */
export type TextileBatchSave = ProductSaveParent & TextileBatchSeed

/** What `save_product` takes to create a single-child product in the order. */
export function singleChildSave(orderId: string, seed: SingleChildSave) {
  return {
    p_product: { order_id: orderId, department: seed.department, type: seed.type, quantity: seed.quantity },
    p_child: seed.child as Json,
  }
}

/** What `save_product` takes to create a textile batch in the order. */
export function textileBatchSave(orderId: string, seed: TextileBatchSave) {
  return {
    p_product: { order_id: orderId, department: seed.department, type: seed.type, quantity: seed.quantity },
    p_garments: seed.garments as Json,
    p_designs: seed.designs as Json,
  }
}

// ── CopyShop ──────────────────────────────────────────────────────────────

/** A poster. */
export const POSTER_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'POSTER',
  quantity: 1,
  childTable: 'poster_products',
  child: { format: 'A2', width: 420, height: 594, material: '120G_AFFICHEN', laminate: 'NEIN' },
}

/** A card flyer. */
export const CARD_FLYER_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'CARD_FLYER',
  quantity: 500,
  childTable: 'card_flyer_products',
  child: { format: 'A6', width: 105, height: 148, color_mode: '4_4', full_bleed: true, production_path: 'CC', cc_material: '300G' },
}

/** A folded flyer. */
export const FOLDED_FLYER_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'FOLDED_FLYER',
  quantity: 250,
  childTable: 'folded_flyer_products',
  child: { format: 'A4', width: 210, height: 297, color_mode: '4_4', full_bleed: false, production_path: 'CC', cc_material: '160G', fold_type: 'WICKELFALZ', page_count: 6 },
}

/** A brochure. */
export const BROCHURE_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'BROCHURE',
  quantity: 50,
  childTable: 'brochure_products',
  child: { format: 'A5', width: 148, height: 210, orientation: 'HOCHFORMAT', page_count: 16, full_bleed: true, production_path: 'CC', cover_material: '250G', inner_material: '120G' },
}

/** A business card. */
export const BUSINESS_CARD_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'BUSINESS_CARD',
  quantity: 200,
  childTable: 'business_card_products',
  child: { format: 'STANDARD_85_55', width: 85, height: 55, orientation: 'QUERFORMAT', color_mode: '4_4', material: '300G_CC', film_laminated: false, full_bleed: true },
}

/** A binding. */
export const BINDING_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'BINDING',
  quantity: 3,
  childTable: 'binding_products',
  child: { format: 'A4', width: 210, height: 297, orientation: 'HOCHFORMAT', material: '100G', color_mode: '4_0', binding_type: 'WIRE_O', binding_color: 'SCHWARZ', full_bleed: false, hardcover_print: false },
}

/** A printout. */
export const PRINTOUT_SAVE: SingleChildSave = {
  department: 'COPYSHOP',
  type: 'PRINTOUT',
  quantity: 20,
  childTable: 'printout_products',
  child: { format: 'A4', material: '80G', color_mode: '1_0', punching: '2_LOCH', staple: true, laminate: 'NEIN' },
}

// ── Stamp ─────────────────────────────────────────────────────────────────

/** A Trodat Printy stamp. */
export const TRODAT_PRINTY_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'TRODAT_PRINTY',
  quantity: 1,
  childTable: 'trodat_printy_products',
  child: { model_id: IN_STOCK_STAMP_MODEL.id, color: 'BLACK', description: 'E2E printy text' },
}

/** A wooden stamp. */
export const WOODEN_STAMP_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'WOODEN_STAMP',
  quantity: 1,
  childTable: 'wooden_stamp_products',
  child: { model_id: IN_STOCK_STAMP_MODEL.id, color: 'RED', description: 'E2E wooden stamp text' },
}

/** A stand stamp. */
export const STAND_STAMP_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'STAND_STAMP',
  quantity: 1,
  childTable: 'stand_stamp_products',
  child: { width: 60, height: 40, color: 'BLUE', description: 'E2E stand stamp text' },
}

/** A date stamp. */
export const DATE_STAMP_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'DATE_STAMP',
  quantity: 1,
  childTable: 'date_stamp_products',
  child: { width: 45, height: 30, color: 'GREEN', description: 'E2E date stamp text' },
}

/** An other stamp. */
export const OTHER_STAMP_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'OTHER_STAMP',
  quantity: 1,
  childTable: 'other_stamp_products',
  child: { width: 50, height: 20, color: 'OTHER', color_other: 'Violet', description: 'E2E other stamp text' },
}

/** A stamp plate. */
export const STAMP_PLATE_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'STAMP_PLATE',
  quantity: 2,
  childTable: 'stamp_plate_products',
  child: { width: 47, height: 18 },
}

/** A refill ink. */
export const REFILL_INK_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'REFILL_INK',
  quantity: 1,
  childTable: 'refill_ink_products',
  child: { color: 'BLACK', ink_type: 'NORMAL' },
}

/** An ink pad. */
export const INK_PAD_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'INK_PAD',
  quantity: 1,
  childTable: 'ink_pad_products',
  child: { pad_size: 'MEDIUM', color: 'RED' },
}

/** A Trodat replacement pad. */
export const TRODAT_PAD_SAVE: SingleChildSave = {
  department: 'STAMP',
  type: 'TRODAT_PAD',
  quantity: 1,
  childTable: 'trodat_pad_products',
  child: { pad_article_number: '6/4912', pad_variant_id: IN_STOCK_STAMP_MODEL.id, color: 'BLACK' },
}

// ── Large format ──────────────────────────────────────────────────────────

/** A sticker. */
export const STICKER_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'STICKER',
  quantity: 100,
  childTable: 'sticker_products',
  child: { material: '3551', contour_cut: 'FREIFORM', laminate: 'MATT', output: 'BOGEN', width: 50, height: 50 },
}

/** A UV-printed sign. */
export const SIGN_UV_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'SIGN_UV',
  quantity: 1,
  childTable: 'sign_uv_products',
  child: { material: 'ALUVERBUND', print_side: 'EINSEITIG', width: 600, height: 400, round_corners: true, drill_holes: false },
}

/** A foil sign. */
export const SIGN_FOIL_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'SIGN_FOIL',
  quantity: 1,
  childTable: 'sign_foil_products',
  child: { material: 'PVC', laminate: 'GLAENZEND', print_side: 'EINSEITIG', width: 500, height: 300, round_corners: false, drill_holes: true, drill_hole_diameter: 5, drill_hole_position: 'E2E four corners' },
}

/** A plotted foil. */
export const FOIL_PLOTTER_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'FOIL_PLOTTER',
  quantity: 4,
  childTable: 'foil_plotter_products',
  child: { material: '751C', output: 'EINZEL', width: 300, height: 120 },
}

/** A banner. */
export const BANNER_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'BANNER',
  quantity: 1,
  childTable: 'banner_products',
  child: { material: 'PVC_FRONTLIT', width: 2000, height: 1000, hem: true, hem_sides: 'E2E all sides', eyelets: true, eyelet_detail: 'E2E every 50 cm' },
}

/** A roll-up. */
export const ROLLUP_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'ROLLUP',
  quantity: 1,
  childTable: 'rollup_products',
  child: { material: 'ROLLUP_FILM', rollup_system: 'NEUE_KASSETTE', rollup_width: 85 },
}

/** A vehicle lettering. */
export const VEHICLE_LETTERING_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'VEHICLE_LETTERING',
  quantity: 1,
  childTable: 'vehicle_lettering_products',
  child: { vehicle_make: 'E2E Make', vehicle_model: 'E2E Van', area_sides: true, area_front: false, area_rear: true, installation: 'MIT', existing_wrap: false, installation_date: '2027-01-15' },
}

/** An other large-format product. */
export const OTHER_LFP_SAVE: SingleChildSave = {
  department: 'LFP',
  type: 'OTHER_LFP',
  quantity: 1,
  childTable: 'other_lfp_products',
  child: { description: 'E2E other large-format product' },
}

// ── Laser engraving ───────────────────────────────────────────────────────

/** An engraved sign. */
export const SIGN_SAVE: SingleChildSave = {
  department: 'LASER_ENGRAVING',
  type: 'SIGN',
  quantity: 1,
  childTable: 'sign_products',
  child: { motif: 'E2E sign motif', material: 'ABS_SW', width: 100, height: 50, round_corners: false, self_adhesive: true },
}

/** A trophy plate. */
export const TROPHY_PLATE_SAVE: SingleChildSave = {
  department: 'LASER_ENGRAVING',
  type: 'TROPHY_PLATE',
  quantity: 5,
  childTable: 'trophy_plate_products',
  child: { motif: 'E2E trophy motif', material: 'ABS_GS', width: 60, height: 20, round_corners: true, self_adhesive: true },
}

/** A name tag. */
export const NAME_TAG_SAVE: SingleChildSave = {
  department: 'LASER_ENGRAVING',
  type: 'NAME_TAG',
  quantity: 10,
  childTable: 'name_tag_products',
  child: { motif: 'E2E name', material: 'ABS_WS', width: 70, height: 25, round_corners: true },
}

/** A gift item. */
export const GIFT_ITEM_SAVE: SingleChildSave = {
  department: 'LASER_ENGRAVING',
  type: 'GIFT_ITEM',
  quantity: 1,
  childTable: 'gift_item_products',
  child: { motif: 'E2E gift motif', material_free_text: 'E2E slate coaster', origin: 'KUNDENMATERIAL' },
}

/** An other laser product. */
export const OTHER_LASER_SAVE: SingleChildSave = {
  department: 'LASER_ENGRAVING',
  type: 'OTHER_LASER',
  quantity: 1,
  childTable: 'other_laser_products',
  child: { motif: 'E2E other motif', material_free_text: 'E2E plywood', origin: 'EIGENMATERIAL', self_adhesive: false },
}

// ── Other ─────────────────────────────────────────────────────────────────

/** An other product. */
export const OTHER_SAVE: SingleChildSave = {
  department: 'OTHER',
  type: 'OTHER',
  quantity: 2,
  childTable: 'other_products',
  child: { description: 'E2E other product' },
}

// ── Textile ───────────────────────────────────────────────────────────────

/** A textile batch: one shop-supplied garment line on the catalog variant and one text design. */
export const TEXTILE_BATCH_SAVE: TextileBatchSave = {
  department: 'TEXTILE',
  type: 'TEXTILE_GARMENT',
  quantity: null,
  garments: [
    {
      origin: 'SHOP_SUPPLIED',
      variant_id: IN_STOCK_TEXTILE_CHAIN.variant.id,
      color: IN_STOCK_TEXTILE_CHAIN.variant.color,
      size: IN_STOCK_TEXTILE_CHAIN.variant.size,
      quantity: 3,
      sort_order: 0,
    },
  ],
  designs: [
    {
      type: 'TEXT',
      content: 'E2E team name',
      color: 'White',
      font_class: 'SANS_SERIF',
      placement: 'E2E chest',
      size: 'E2E 10 cm wide',
      print_method: 'E2E flex',
    },
  ],
}
