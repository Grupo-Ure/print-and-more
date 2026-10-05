/**
 * The option lists of a textile batch's stored enum values, and the labels they
 * display under.
 *
 * Shared by the batch editor, which offers them, and the PDF production sheet,
 * which names a stored value — and the sheet is generated from `src/lib`, which
 * holds no component imports. The values themselves mirror the columns on
 * `textile_garments` and `textile_designs`.
 */

export type TextileOption = { value: string; label: string }

/** Who supplies the garment (`textile_garments.origin`). */
export const TEXTILE_ORIGIN_OPTIONS: TextileOption[] = [
  { value: 'SHOP_SUPPLIED', label: 'Shop-supplied' },
  { value: 'CUSTOMER_SUPPLIED', label: 'Customer-supplied' },
]

/** What the garment is, for a free-text line (`textile_garments.garment_type`). */
export const TEXTILE_GARMENT_TYPE_OPTIONS: TextileOption[] = [
  { value: 'T_SHIRT', label: 'T-Shirt' },
  { value: 'POLO', label: 'Polo' },
  { value: 'SWEATSHIRT', label: 'Sweatshirt' },
  { value: 'HOODIE', label: 'Hoodie' },
  { value: 'ZIP_HOODIE', label: 'Zip Hoodie' },
  { value: 'JACKET', label: 'Jacket' },
  { value: 'OTHER', label: 'Other' },
]

/** Where a design sits on the garment (`textile_designs.placement`). */
export const TEXTILE_PLACEMENT_OPTIONS: TextileOption[] = [
  { value: 'CHEST_LEFT', label: 'Chest left' },
  { value: 'CHEST_CENTRE', label: 'Chest centre' },
  { value: 'CHEST_RIGHT', label: 'Chest right' },
  { value: 'BACK', label: 'Back' },
  { value: 'SLEEVE_LEFT', label: 'Sleeve left' },
  { value: 'SLEEVE_RIGHT', label: 'Sleeve right' },
  { value: 'OTHER', label: 'Other' },
]

/** How large the design is applied (`textile_designs.size`). */
export const TEXTILE_APPLICATION_SIZE_OPTIONS: TextileOption[] = [
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
  { value: 'CUSTOM', label: 'Custom' },
]

/** The look of a text design's font (`textile_designs.font_class`). */
export const TEXTILE_FONT_CLASS_OPTIONS: TextileOption[] = [
  { value: 'SANS_SERIF', label: 'Sans-serif' },
  { value: 'SERIF', label: 'Serif' },
  { value: 'ELEGANT', label: 'Elegant' },
  { value: 'PLAYFUL', label: 'Playful' },
]

/** The label a stored value displays under, falling back to the value itself. */
export function textileOptionLabel(options: TextileOption[], value: string | null): string {
  if (!value) return '—'
  return options.find(option => option.value === value)?.label ?? value
}
