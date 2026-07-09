/**
 * Type definitions for the Textile department.
 *
 * Textile is a product department: a garment line is a `department_products`
 * row of type `TEXTILE_GARMENT` with a `textile_garment_products` typed child
 * ({@link TextileGarmentRow}) — a quantity of one garment, either OWN_STOCK
 * (a stock-tracked `textile_variants` reference) or CUSTOMER_STOCK (free-text).
 *
 * Decorations live in a per-job reusable **designs drawer**
 * ({@link TextileMotifRow} — the artwork or text) and are applied to garment
 * products through an attributed link ({@link TextileMotifLinkRow}) that carries
 * the placement/size/method of each use. (The pre-product relational model —
 * positions + assignments — is gone.)
 */

import type { Tables, TablesInsert } from './supabase'

/** Discriminator: a design is free text vs a linked file. */
export type TextileMotifType = 'TEXT' | 'FILE'

/** Coarse font classification for text designs. */
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

/** Where on the garment a design is placed (carried by the link). */
export type TextilePlacement =
  | 'BRUST_LINKS'
  | 'BRUST_MITTE'
  | 'BRUST_RECHTS'
  | 'RUECKEN'
  | 'ARM_LINKS'
  | 'ARM_RECHTS'
  | 'SONSTIGE'

/** Design application size — discrete buckets plus a free-text fallback. */
export type TextileSize = 'KLEIN' | 'MITTEL' | 'GROSS' | 'FREI'

/** Garment line — the `textile_garment_products` typed child of a product. */
export type TextileGarmentRow = Tables<'textile_garment_products'>
export type TextileGarmentInsert = TablesInsert<'textile_garment_products'>

/**
 * Row from `textile_motifs`: a design in the job's reusable drawer. The
 * design is just the artwork/text — placement/size/method live on the link.
 */
export type TextileMotifRow = {
  id: string
  job_id: string
  type: TextileMotifType
  content: string | null
  color: string | null
  font_class: string | null
  font_name: string | null
  file_id: string | null
}

/**
 * Row from `textile_motif_links`: applies a design ({@link TextileMotifRow}) to
 * a garment product at a placement/size/method. The attributed M:N that
 * replaces the old motif↔position assignment.
 */
export type TextileMotifLinkRow = {
  id: string
  department_product_id: string
  motif_id: string
  placement: string
  size: string
  print_method: string | null
}

/** A design application as held in the garment form / passed to the save layer.
 * `id` present = an existing `textile_motif_links` row (update), else a new link. */
export type TextileMotifLinkInput = {
  id?: string
  motif_id: string
  placement: string
  size: string
  print_method: string | null
}

/** Compact reference to an order file; used inside Textile composites where only display name and role matter. */
export type FileRef = {
  id: string
  display_name: string
  role: string
}
