import type { CustomerContactJoin, CustomerContactRow } from '../types/database'

/** Local form-type for dialogs and search (table `kunden`) */
export type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  note: string | null
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}

function contactRow(join: CustomerContactJoin | null | undefined): CustomerContactRow | null {
  if (join == null) return null
  return Array.isArray(join) ? (join[0] ?? null) : join
}

/** Maps an order join (kunden) to the form-level Customer type. */
export function contactJoinToCustomer(join: CustomerContactJoin | null | undefined): Customer | null {
  const contact = contactRow(join)
  if (contact == null || !contact.id) return null
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    note: contact.note,
    street: contact.street ?? null,
    house_number: contact.house_number ?? null,
    postal_code: contact.postal_code ?? null,
    city: contact.city ?? null,
  }
}
