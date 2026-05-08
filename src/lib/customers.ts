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

function contactRow(k: CustomerContactJoin | null | undefined): CustomerContactRow | null {
  if (k == null) return null
  return Array.isArray(k) ? (k[0] ?? null) : k
}

/** Maps an order join (kunden) to the form-level Customer type. */
export function contactJoinToCustomer(k: CustomerContactJoin | null | undefined): Customer | null {
  const z = contactRow(k)
  if (z == null || !z.id) return null
  return {
    id: z.id,
    name: z.name,
    email: z.email,
    telefon: z.telefon,
    notiz: z.notiz,
    strasse: z.strasse ?? null,
    hausnummer: z.hausnummer ?? null,
    plz: z.plz ?? null,
    ort: z.ort ?? null,
  }
}
