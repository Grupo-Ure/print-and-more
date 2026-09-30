/**
 * The bounce-back policy: whether a spec change is "meaningful" enough to drop
 * a committed (IN_PRODUCTION / DONE) product back to IN_SETUP.
 *
 * Per department (spec §5):
 * - Stamp / Other → only the product's `description` changing counts.
 * - Laser → only the product's `motif` changing counts.
 * - LFP / CopyShop / Textile → any product change counts.
 *
 * Only an *edit* is routed here. Creating or deleting a product used to bounce
 * its job back, because the job's content had changed; a product is its own
 * content, so a new one starts in setup and a deleted one is gone — neither can
 * bounce anything. Schedule/meta edits (deadline/delivery/priority/…) never
 * touch the spec, so they never bounce either, which matches the spec.
 *
 * Pure, no I/O. `prevChild`/`nextChild` are the typed product child rows (or null).
 */
export function isMeaningfulChange(
  department: string,
  prevChild: Record<string, unknown> | null,
  nextChild: Record<string, unknown> | null,
): boolean {
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
