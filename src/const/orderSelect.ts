/** SELECT for `auftraege` incl. customer join (list, detail, status sync) */
export const ORDER_COLUMNS =
  'id, auftragsnummer, status, kunden(id, name, email, telefon, notiz, strasse, hausnummer, plz, ort), erp_exportiert, archiviert, termin, lieferung, prioritaet, notfall_aktiv, erstellt_am' as const
