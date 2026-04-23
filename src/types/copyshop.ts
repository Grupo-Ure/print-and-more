/**
 * Copy-Shop-Teilaufträge: `typ` in Spalte `teilauftraege`, Detaildaten in JSONB `detail`.
 */

export const COPY_SHOP_TYPS = [
  'PLAKAT_POSTER',
  'KARTE_FLYER',
  'FALZFLYER',
  'BROSCHUERE',
  'VISITENKARTE',
  'BINDUNG',
  'AUSDRUCK',
] as const

export type CopyShopTeiltyp = (typeof COPY_SHOP_TYPS)[number]

export const COPY_SHOP_TYPS_ANZEIGE: Record<CopyShopTeiltyp, string> = {
  PLAKAT_POSTER: 'Plakat/Poster',
  KARTE_FLYER: 'Karte & Flyer',
  FALZFLYER: 'Falzflyer',
  BROSCHUERE: 'Broschüre',
  VISITENKARTE: 'Visitenkarte',
  BINDUNG: 'Bindung',
  AUSDRUCK: 'Ausdruck',
}

export type CopyShopDetailJson = Record<string, unknown>

export type ProduktionswegWahl = 'COPYSHOP' | 'OFFSET'
