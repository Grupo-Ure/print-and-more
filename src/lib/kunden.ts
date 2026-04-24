import type { KundeKontaktJoin, KundeKontaktRow } from '../types/database'

/** Kunde für Dialoge und Suche (Tabelle `kunden`) */
export type Kunde = {
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

function zeileKontakt(k: KundeKontaktJoin | null | undefined): KundeKontaktRow | null {
  if (k == null) return null
  return Array.isArray(k) ? (k[0] ?? null) : k
}

/** Aus Auftrag-Join (kunden) → Formular-`Kunde` */
export function kontaktJoinZuKunde(k: KundeKontaktJoin | null | undefined): Kunde | null {
  const z = zeileKontakt(k)
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
