import type { CustomerContactJoin, CustomerContactRow } from '../types/database'

/** Local form-type for dialogs and search (table `kunden`) */
export type Customer = {
  id: string
  name: string
  email: string | null
  telefon: string | null
  notiz: string | null
  strasse: string | null
  hausnummer: string | null
  plz: string | null
  ort: string | null
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
    telefon: contact.telefon,
    notiz: contact.notiz,
    strasse: contact.strasse ?? null,
    hausnummer: contact.hausnummer ?? null,
    plz: contact.plz ?? null,
    ort: contact.ort ?? null,
  }
}
