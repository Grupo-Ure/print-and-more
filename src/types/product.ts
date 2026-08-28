import type { Tables, TablesInsert } from './supabase'

/**
 * Product domain model over the typed per-type schema.
 *
 * A product = one `department_products` parent row (department, type, quantity,
 * notes, sort_order) + one typed child row in the table chosen by `type`. The
 * child carries the English spec columns; its PK `department_product_id` equals
 * the parent `id`.
 */

export type ProductParent = Tables<'department_products'>

/** Every per-type child table. */
export type ChildTable =
  // CopyShop
  | 'poster_products'
  | 'card_flyer_products'
  | 'folded_flyer_products'
  | 'brochure_products'
  | 'business_card_products'
  | 'binding_products'
  | 'printout_products'
  // Stamp
  | 'trodat_printy_products'
  | 'wooden_stamp_products'
  | 'stand_stamp_products'
  | 'date_stamp_products'
  | 'other_stamp_products'
  | 'stamp_plate_products'
  | 'refill_ink_products'
  | 'ink_pad_products'
  | 'trodat_pad_products'
  // LFP
  | 'sticker_products'
  | 'sign_uv_products'
  | 'sign_foil_products'
  | 'foil_plotter_products'
  | 'banner_products'
  | 'rollup_products'
  | 'vehicle_lettering_products'
  | 'other_lfp_products'
  // Laser
  | 'sign_products'
  | 'trophy_plate_products'
  | 'name_tag_products'
  | 'gift_item_products'
  | 'other_laser_products'
  // Other
  | 'other_products'
  // Textile
  | 'textile_garment_products'

/** Union of all child Row types (the spec columns, incl. department_product_id). */
export type ProductChildRow = { [K in ChildTable]: Tables<K> }[ChildTable]

/** Union of all child Insert types, minus the PK (the service fills it). */
export type ProductChildInsert = {
  [K in ChildTable]: Omit<TablesInsert<K>, 'department_product_id'>
}[ChildTable]

/**
 * A product loaded from the DB: parent columns + its typed child row.
 *
 * Discriminated on `type`, so narrowing the discriminator narrows the child:
 * `if (product.type === 'TRODAT_PRINTY') product.child.model_id` type-checks
 * with no cast. The DB column is plain `text`; the literal type is asserted
 * once, where rows are assembled in `departmentProductService`.
 */
export type LoadedProduct = {
  [Type in ProductType]: Omit<ProductParent, 'type'> & {
    type: Type
    child: Tables<(typeof CHILD_TABLE_BY_TYPE)[Type]>
  }
}[ProductType]

/** Input to create or update a product (id present = update). */
export type ProductWriteInput = {
  id?: string
  job_id: string
  department: string
  type: string
  quantity: number | null
  notes: string | null
  sort_order: number
  child: ProductChildInsert
}

/**
 * The product `type` discriminator → its child table.
 *
 * `as const satisfies` keeps the key and value literals (which drive
 * `ProductType` and `LoadedProduct`) while still checking every value is a
 * real child table.
 */
export const CHILD_TABLE_BY_TYPE = {
  // CopyShop
  POSTER: 'poster_products',
  CARD_FLYER: 'card_flyer_products',
  FOLDED_FLYER: 'folded_flyer_products',
  BROCHURE: 'brochure_products',
  BUSINESS_CARD: 'business_card_products',
  BINDING: 'binding_products',
  PRINTOUT: 'printout_products',
  // Stamp
  TRODAT_PRINTY: 'trodat_printy_products',
  WOODEN_STAMP: 'wooden_stamp_products',
  STAND_STAMP: 'stand_stamp_products',
  DATE_STAMP: 'date_stamp_products',
  OTHER_STAMP: 'other_stamp_products',
  STAMP_PLATE: 'stamp_plate_products',
  REFILL_INK: 'refill_ink_products',
  INK_PAD: 'ink_pad_products',
  TRODAT_PAD: 'trodat_pad_products',
  // LFP
  STICKER: 'sticker_products',
  SIGN_UV: 'sign_uv_products',
  SIGN_FOIL: 'sign_foil_products',
  FOIL_PLOTTER: 'foil_plotter_products',
  BANNER: 'banner_products',
  ROLLUP: 'rollup_products',
  VEHICLE_LETTERING: 'vehicle_lettering_products',
  OTHER_LFP: 'other_lfp_products',
  // Laser
  SIGN: 'sign_products',
  TROPHY_PLATE: 'trophy_plate_products',
  NAME_TAG: 'name_tag_products',
  GIFT_ITEM: 'gift_item_products',
  OTHER_LASER: 'other_laser_products',
  // Other
  OTHER: 'other_products',
  // Textile
  TEXTILE_GARMENT: 'textile_garment_products',
} as const satisfies Record<string, ChildTable>

/** Every valid product `type` discriminator value. */
export type ProductType = keyof typeof CHILD_TABLE_BY_TYPE

/** Runtime guard: is this DB `type` string one we know? */
export function isProductType(type: string): type is ProductType {
  return type in CHILD_TABLE_BY_TYPE
}

export function childTableForType(type: string): ChildTable {
  if (!isProductType(type)) throw new Error(`Unknown product type: ${type}`)
  return CHILD_TABLE_BY_TYPE[type]
}
