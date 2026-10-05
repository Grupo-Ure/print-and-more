/**
 * Type definitions for the Textile department.
 *
 * Textile offers exactly one product type, and it is a *batch*: one product
 * holds many garment lines (model × colour × size, each with its own quantity)
 * and the designs applied to all of them. That is why it is the one department
 * whose product has no single typed child row — see `LoadedProduct` in
 * `src/types/product.ts`.
 */

/** The textile types a department picker offers. One type only: the batch. */
export const TEXTILE_ALL_TYPES = ['TEXTILE_GARMENT'] as const

/** Display labels for every type in {@link TEXTILE_ALL_TYPES}. */
export const TEXTILE_ALL_LABELS: Record<string, string> = {
  TEXTILE_GARMENT: 'Garment batch',
}
