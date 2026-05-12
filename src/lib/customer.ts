import type { CustomerJoin, CustomerContactJoin, CustomerContactRow } from '../types/database'

export function customerName(join: CustomerJoin | undefined): string {
  if (join == null) return '—'
  const row = Array.isArray(join) ? join[0] : join
  return row?.name?.trim() ? row.name : '—'
}

function contactRow(join: CustomerContactJoin | null | undefined): CustomerContactRow | null {
  if (join == null) return null
  return Array.isArray(join) ? (join[0] ?? null) : join
}

/** Name + (email or phone) required for the auto-prepress rule. */
export function customerMeetsPrepressContact(join: CustomerContactJoin | null | undefined): boolean {
  const contact = contactRow(join)
  if (contact == null) return false
  if (!contact.name?.trim()) return false
  if (contact.email?.trim() || contact.phone?.trim()) return true
  return false
}
