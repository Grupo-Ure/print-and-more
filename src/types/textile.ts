/**
 * Type definitions for the Textile (Textil) department.
 *
 * Textile sub-orders are decorated garments: T-shirts, polos, sweatshirts,
 * hoodies, zip hoodies, jackets, and miscellaneous garments. The work
 * model is two-sided: a sub-order is composed of {@link TextileMotifRow}
 * (the artwork to be applied — text or file) and {@link TextilePositionRow}
 * (one quantity-bearing row per garment configuration: brand/model/size/
 * color, sourced as customer-supplied or in-house stock). Motifs and
 * positions are then linked via {@link TextileAssignmentRow}, which
 * carries the (motif × placement) assignment with embedded copies of
 * both sides for display.
 *
 * Inline DB tables `textile_motifs`, `textile_positions`, `textile_assignments`,
 * and `textile_variants` mirror these row types, joined via PostgREST
 * embeds (the `textile_motifs`/`textile_positions` keys on the
 * assignment row).
 */

/** Discriminator: motif is free text vs an uploaded file. */
export type TextileMotifType = 'TEXT' | 'FILE'

/** Coarse font classification for text motifs. */
export type TextileFontClass = 'SANS_SERIF' | 'SERIF' | 'ELEGANT' | 'PLAYFUL'

/** Whether the garment was supplied by the customer or pulled from in-house stock. */
export type TextileOrigin = 'CUSTOMER_STOCK' | 'OWN_STOCK'

/** Garment kinds for customer-supplied items (CUSTOMER_STOCK). In-house stock
 * doesn't use this; it derives garment info from the variant catalog. */
export type TextileCustomerGarmentType =
  | 'T_SHIRT'
  | 'POLO'
  | 'SWEATSHIRT'
  | 'HOODIE'
  | 'ZIP_HOODIE'
  | 'JACKE'
  | 'SONSTIGES'

/** Where on the garment a motif is placed. */
export type TextilePlacement =
  | 'BRUST_LINKS'
  | 'BRUST_MITTE'
  | 'BRUST_RECHTS'
  | 'RUECKEN'
  | 'ARM_LINKS'
  | 'ARM_RECHTS'
  | 'SONSTIGE'

/** Motif size — discrete buckets plus a free-text fallback. */
export type TextileSize = 'KLEIN' | 'MITTEL' | 'GROSS' | 'FREI'

/** Row from `textile_motifs`: the artwork to be applied. */
export type TextileMotifRow = {
  id: string
  department_order_id: string
  type: TextileMotifType
  placement: TextilePlacement
  size: string
  print_method: string | null
  content: string | null
  color: string | null
  font_class: string | null
  font_name: string | null
  file_id: string | null
}

/** Row from `textile_positions`: one garment configuration with quantity. */
export type TextilePositionRow = {
  id: string
  department_order_id: string
  origin: TextileOrigin
  type: string | null
  color: string | null
  quantity: number
  brand: string | null
  model: string | null
  size: string | null
  /** Catalog reference (DB `textile_positions.variant_id`) for in-house stock. */
  variant_id: string | null
}

/** Embedded motif shape inside a {@link TextileAssignmentRow}. */
export type TextileNestedMotif = {
  type: TextileMotifType
  placement: string
  size: string
  print_method: string | null
  content: string | null
  file_id: string | null
}

/** Embedded position shape inside a {@link TextileAssignmentRow}. */
export type TextileNestedPosition = {
  origin: TextileOrigin
  type: string | null
  color: string | null
  brand: string | null
  model: string | null
  size: string | null
}

/**
 * Row from `textile_assignments`: links a motif to a position. PostgREST
 * embeds expand the related motif and position rows; the embed shape may
 * be an object or a single-element array depending on the query.
 */
export type TextileAssignmentRow = {
  id: string
  department_order_id: string
  motif_id: string
  position_id: string
  /** PostgREST embed; may be an object or a single-element array. */
  textile_motifs?: TextileNestedMotif | TextileNestedMotif[] | null
  textile_positions?: TextileNestedPosition | TextileNestedPosition[] | null
}

/** Compact reference to an order file; used inside Textile composites where only display name and role matter. */
export type FileRef = {
  id: string
  display_name: string
  role: string
}

/**
 * Shape of the Textile sub-order's `detail` JSONB column.
 *
 * The validator only uses one inner flag (`detail.textil.voll`) to gate
 * prepress release; the rest of Textile data lives in the related
 * `textile_motifs`, `textile_positions`, `textile_assignments` tables.
 */
export type TextileSubOrderDetail = {
  textil?: { voll?: boolean }
}
