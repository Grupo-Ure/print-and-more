import type { CustomerJoin, CustomerContactJoin, CustomerContactRow } from '../types/database'

export function customerName(k: CustomerJoin | undefined): string {
  if (k == null) return '—'
  const zeile = Array.isArray(k) ? k[0] : k
  return zeile?.name?.trim() ? zeile.name : '—'
}

function contactRow(k: CustomerContactJoin | null | undefined): CustomerContactRow | null {
  if (k == null) return null
  return Array.isArray(k) ? (k[0] ?? null) : k
}

/** Name + (email or phone) required for the auto-prepress rule. */
export function customerMeetsPrepressContact(k: CustomerContactJoin | null | undefined): boolean {
  const z = contactRow(k)
  if (z == null) return false
  if (!z.name?.trim()) return false
  if (z.email?.trim() || z.telefon?.trim()) return true
  return false
}
