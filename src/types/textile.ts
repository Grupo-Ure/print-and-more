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
 * Inline DB tables `textil_motive`, `textil_positionen`, `textil_zuordnungen`,
 * and `textil_varianten` mirror these row types, joined via PostgREST
 * embeds (the `textil_motive`/`textil_positionen` keys on the
 * assignment row).
 */

/** Discriminator: motif is free text vs an uploaded file. */
export type TextileMotifType = 'TEXT' | 'DATEI'

/** Coarse font classification for text motifs. */
export type TextileFontClass = 'SERIFENLOS' | 'SERIFEN' | 'ELEGANT' | 'VERSPIELT'

/** Whether the garment was supplied by the customer or pulled from in-house stock. */
export type TextileOrigin = 'KUNDENWARE' | 'EIGENWARE'

/** Garment kinds for customer-supplied items (KUNDENWARE). In-house stock
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

/** Row from `textil_motive`: the artwork to be applied. */
export type TextileMotifRow = {
  id: string
  teilauftrag_id: string
  typ: TextileMotifType
  platz: TextilePlacement
  groesse: string
  druckart: string | null
  inhalt: string | null
  farbe: string | null
  schriftklasse: string | null
  schriftart: string | null
  datei_id: string | null
}

/** Row from `textil_positionen`: one garment configuration with quantity. */
export type TextilePositionRow = {
  id: string
  teilauftrag_id: string
  herkunft: TextileOrigin
  typ: string | null
  farbe: string | null
  stueckzahl: number
  marke: string | null
  modell: string | null
  groesse: string | null
  /** Catalog reference (DB `textil_positionen.variante_id`) for in-house stock. */
  variante_id: string | null
}

/** Embedded motif shape inside a {@link TextileAssignmentRow}. */
export type TextileNestedMotif = {
  typ: TextileMotifType
  platz: string
  groesse: string
  druckart: string | null
  inhalt: string | null
  datei_id: string | null
}

/** Embedded position shape inside a {@link TextileAssignmentRow}. */
export type TextileNestedPosition = {
  herkunft: TextileOrigin
  typ: string | null
  farbe: string | null
  marke: string | null
  modell: string | null
  groesse: string | null
}

/**
 * Row from `textil_zuordnungen`: links a motif to a position. PostgREST
 * embeds expand the related motif and position rows; the embed shape may
 * be an object or a single-element array depending on the query.
 */
export type TextileAssignmentRow = {
  id: string
  teilauftrag_id: string
  motiv_id: string
  position_id: string
  /** PostgREST embed; may be an object or a single-element array. */
  textil_motive?: TextileNestedMotif | TextileNestedMotif[] | null
  textil_positionen?: TextileNestedPosition | TextileNestedPosition[] | null
}

/**
 * Compact reference to an order file; used inside Textile composites
 * where only display name and role matter. Kept with the German `Datei`
 * prefix until the cross-cutting `Datei` type is renamed.
 */
export type DateiKurz = {
  id: string
  anzeigename: string
  rolle: string
}

/**
 * Shape of the Textile sub-order's `detail` JSONB column.
 *
 * The validator only uses one inner flag (`detail.textil.voll`) to gate
 * prepress release; the rest of Textile data lives in the related
 * `textil_motive`, `textil_positionen`, `textil_zuordnungen` tables.
 */
export type TextileSubOrderDetail = {
  textil?: { voll?: boolean }
}
