/**
 * The bounce-back policy: whether a product/content change is "meaningful" enough to
 * drop a committed (PRODUCTION_READY / DONE) sub-order back to INCOMPLETE.
 *
 * Per department (spec §5):
 * - Stamp / Other → only the product's `description` changing counts.
 * - Laser → only the product's `motif` changing counts.
 * - LFP / CopyShop / Textile → any product change counts.
 *
 * A product create or delete is always meaningful (content added/removed). For an
 * update, the narrow departments compare the one field; everyone else counts any
 * update. Schedule/meta edits (deadline/delivery/priority/…) are NOT routed here — they
 * never touch product content — so they never bounce, which matches the spec.
 *
 * Pure, no I/O. `prevChild`/`nextChild` are the typed product child rows (or null).
 */
export function isMeaningfulChange(
  department: string,
  kind: 'create' | 'update' | 'delete',
  prevChild: Record<string, unknown> | null,
  nextChild: Record<string, unknown> | null,
): boolean {
  if (kind === 'create' || kind === 'delete') return true

  const field = meaningfulField(department)
  if (field === null) return true // LFP / CopyShop / Textile: any update is meaningful

  // Stamp types without the field (REFILL_INK, INK_PAD, …) have it on neither side →
  // equal → not meaningful, which is the intended behaviour.
  return (prevChild?.[field] ?? null) !== (nextChild?.[field] ?? null)
}

function meaningfulField(department: string): 'description' | 'motif' | null {
  if (department === 'STAMP' || department === 'OTHER') return 'description'
  if (department === 'LASER_ENGRAVING') return 'motif'
  return null
}
