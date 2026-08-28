// ============================================================
// MATERIALIEN-KONFIGURATION
// Zentrale Stelle für alle Materiallisten.
// Änderungsfrequenz: ca. alle 1-2 Jahre.
// Bei Sortimentsänderung nur diese Datei anpassen.
// ============================================================

// ------------------------------------------------------------
// COPYSHOP — Poster/Plakat
// ------------------------------------------------------------
export const POSTER_MATERIALIEN = [
  { wert: '120G_AFFICHEN', anzeige: '120g Affiches' },
  { wert: '200G_SEIDENGLANZ', anzeige: '200g Silk gloss' },
  { wert: '200G_GLANZ', anzeige: '200g Gloss' },
] as const

// ------------------------------------------------------------
// COPYSHOP — CopyShop (CC) Grammaturen
// Gilt für: Flyer, Falzflyer, Broschüre (CC), Ausdruck
// ------------------------------------------------------------
export const CC_GRAMMATUREN = [
  { wert: '80G', anzeige: '80g' },
  { wert: '100G', anzeige: '100g' },
  { wert: '120G', anzeige: '120g' },
  { wert: '160G', anzeige: '160g' },
  { wert: '200G', anzeige: '200g' },
  { wert: '250G', anzeige: '250g' },
  { wert: '300G', anzeige: '300g' },
  { wert: 'SONSTIGE', anzeige: 'Other' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Offset Standard
// ------------------------------------------------------------
export const OFFSET_STANDARD_GRAMMATUREN = [
  { wert: '115G', anzeige: '115g' },
  { wert: '135G', anzeige: '135g' },
  { wert: '170G', anzeige: '170g' },
  { wert: '250G', anzeige: '250g' },
  { wert: '300G', anzeige: '300g' },
  { wert: '350G', anzeige: '350g' },
  { wert: '400G', anzeige: '400g' },
] as const

export const OFFSET_STANDARD_OBERFLAECHEN = [
  { wert: 'MATT', anzeige: 'Matte' },
  { wert: 'GLAENZEND', anzeige: 'Glossy' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Offset Offset
// ------------------------------------------------------------
export const OFFSET_OFFSET_GRAMMATUREN = [
  { wert: '80G', anzeige: '80g' },
  { wert: '90G', anzeige: '90g' },
  { wert: '100G', anzeige: '100g' },
  { wert: '120G', anzeige: '120g' },
  { wert: '150G', anzeige: '150g' },
  { wert: '250G', anzeige: '250g' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Offset Spezial
// ------------------------------------------------------------
export const OFFSET_SPEZIAL_PAPIERE = [
  { wert: '300G_FOLIENKASCHIERT', anzeige: '300g Laminated' },
  { wert: 'RECYCLING', anzeige: 'Recycled' },
  { wert: '250G_LEINENSTRUKTUR', anzeige: '250g Linen texture' },
  { wert: 'SONSTIGE', anzeige: 'Other' },
] as const

export const OFFSET_FOLIENKASCHIERUNG = [
  { wert: 'MATT', anzeige: 'Matte' },
  { wert: 'GLAENZEND', anzeige: 'Glossy' },
] as const

export const OFFSET_FOLIENKASCHIERUNG_SEITEN = [
  { wert: 'EINSEITIG', anzeige: 'Single-sided' },
  { wert: 'BEIDSEITIG', anzeige: 'Double-sided' },
] as const

export const OFFSET_RECYCLING_GRAMMATUREN = [
  { wert: '80G', anzeige: '80g' },
  { wert: '135G', anzeige: '135g' },
  { wert: '150G', anzeige: '150g' },
  { wert: '300G', anzeige: '300g' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Broschüre Offset
// ------------------------------------------------------------
export const BROSCHUERE_OFFSET_UMSCHLAG = [
  { wert: '135G', anzeige: '135g' },
  { wert: '170G', anzeige: '170g' },
  { wert: '250G', anzeige: '250g' },
  { wert: '300G', anzeige: '300g' },
] as const

export const BROSCHUERE_OFFSET_INHALT = [
  { wert: '90G', anzeige: '90g' },
  { wert: '135G', anzeige: '135g' },
  { wert: '170G', anzeige: '170g' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Visitenkarte
// ------------------------------------------------------------
export const VISITENKARTE_MATERIALIEN = [
  { wert: '300G_CC', anzeige: '300g CC' },
  { wert: '350G_OFFSET', anzeige: '350g Offset' },
  { wert: '400G_OFFSET', anzeige: '400g Offset' },
  { wert: '300G_RECYCLING', anzeige: '300g Recycled Offset' },
  { wert: '250G_LEINENSTRUKTUR', anzeige: '250g Linen-textured Offset' },
  { wert: 'MULTILOFT', anzeige: 'Multiloft Offset' },
] as const

export const MULTILOFT_FARBKERNE = [
  { wert: 'SCHWARZ', anzeige: 'Black' },
  { wert: 'ELFENBEIN', anzeige: 'Ivory' },
  { wert: 'WEISS', anzeige: 'White' },
  { wert: 'ROT', anzeige: 'Red' },
  { wert: 'OLIVGRUEN', anzeige: 'Olive green' },
  { wert: 'HELLGRUEN', anzeige: 'Light green' },
  { wert: 'TUERKIS', anzeige: 'Teal' },
  { wert: 'LILA', anzeige: 'Purple' },
  { wert: 'GELB', anzeige: 'Yellow' },
  { wert: 'ORANGE', anzeige: 'Orange' },
  { wert: 'MAGENTA', anzeige: 'Magenta' },
  { wert: 'ROSA', anzeige: 'Pink' },
  { wert: 'BLAU', anzeige: 'Blue' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Bindung
// ------------------------------------------------------------
export const BINDUNG_MATERIALIEN = [
  { wert: '80G', anzeige: '80g' },
  { wert: '100G', anzeige: '100g' },
  { wert: '120G', anzeige: '120g' },
  { wert: 'SONSTIGE', anzeige: 'Other' },
] as const

// ------------------------------------------------------------
// COPYSHOP — Ausdruck
// ------------------------------------------------------------
export const AUSDRUCK_MATERIALIEN = [
  { wert: '80G', anzeige: '80g' },
  { wert: '100G', anzeige: '100g' },
  { wert: '120G', anzeige: '120g' },
  { wert: '160G', anzeige: '160g' },
  { wert: '200G', anzeige: '200g' },
  { wert: '250G', anzeige: '250g' },
  { wert: '300G', anzeige: '300g' },
  { wert: 'SONSTIGE', anzeige: 'Other' },
] as const

// ------------------------------------------------------------
// LFP — Aufkleber
// ------------------------------------------------------------
export const LFP_AUFKLEBER_MATERIALIEN = [
  { wert: '3551', anzeige: '3551' },
  { wert: 'ULTRATACK', anzeige: 'UltraTack' },
  { wert: 'MONSTERTACK', anzeige: 'MonsterTack' },
  { wert: '3162', anzeige: '3162' },
] as const

export const LFP_3551_VARIANTEN = [
  { wert: null, anzeige: '— (none)' },
  { wert: 'RA', anzeige: 'RA' },
  { wert: 'T', anzeige: 'T' },
] as const

// ------------------------------------------------------------
// LFP — Folienplott
// ------------------------------------------------------------
export const LFP_FOLIENPLOTT_MATERIALIEN = [
  { wert: '751C', anzeige: '751c' },
  { wert: '631', anzeige: '631' },
  { wert: '8510', anzeige: '8510' },
] as const

// ------------------------------------------------------------
// DIN-FORMATE (Hochformat, in mm)
// Wird von mehreren Bereichen genutzt
// ------------------------------------------------------------
export const DIN_FORMATE: Record<string, { breite: number; hoehe: number }> = {
  A7: { breite: 74, hoehe: 105 },
  A6: { breite: 105, hoehe: 148 },
  A5: { breite: 148, hoehe: 210 },
  A4: { breite: 210, hoehe: 297 },
  A3: { breite: 297, hoehe: 420 },
  A2: { breite: 420, hoehe: 594 },
  A1: { breite: 594, hoehe: 841 },
  A0: { breite: 841, hoehe: 1189 },
  DIN_LANG: { breite: 99, hoehe: 210 },
}

