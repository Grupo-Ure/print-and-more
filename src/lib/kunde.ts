import type { KundeJoin, KundeKontaktJoin, KundeKontaktRow } from '../types/database'

export function kundenName(k: KundeJoin | undefined): string {
  if (k == null) return '—'
  const zeile = Array.isArray(k) ? k[0] : k
  return zeile?.name?.trim() ? zeile.name : '—'
}

function zeileKontakt(k: KundeKontaktJoin | null | undefined): KundeKontaktRow | null {
  if (k == null) return null
  return Array.isArray(k) ? (k[0] ?? null) : k
}

/** Name + (E-Mail oder Telefon) für Auto-PREPRESS-Regel. */
export function kundeErfuelltPrepressKontakt(k: KundeKontaktJoin | null | undefined): boolean {
  const z = zeileKontakt(k)
  if (z == null) return false
  if (!z.name?.trim()) return false
  if (z.email?.trim() || z.telefon?.trim()) return true
  return false
}
