/** SELECT für `auftraege` inkl. Kunden-Join (Listen, Detail, Status-Sync) */
export const AUFTRAG_SPALTEN =
  'id, auftragsnummer, status, kunden(id, name, email, telefon, notiz), erp_exportiert, archiviert, termin, lieferung, prioritaet, notfall_aktiv, erstellt_am' as const
