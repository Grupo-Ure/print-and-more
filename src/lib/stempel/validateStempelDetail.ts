import {
  STEMPEL_FARBE,
  type StempelDetailJson,
  type StempelFarbe,
  type StempelTeiltyp,
  STEMPEL_TYPEN,
} from '../../types/stempel'
import type { AuftragStatus } from '../../types/database'

function reqStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

function reqEnum<T extends readonly string[]>(v: unknown, allowed: T): T[number] | null {
  const s = reqStr(v)
  if (!s) return null
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : null
}

function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

function anzahlGueltig(d: StempelDetailJson): boolean {
  // Für neue Artikeltypen wird teils "anzahl" erwartet; legacy bleibt "stueckzahl".
  return stueckzahlGueltig(d.anzahl) || stueckzahlGueltig(d.stueckzahl)
}

function positiveGanzzahlOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

const EXTRA_TYPEN = ['NACHFUELLFARBE', 'STEMPELKISSEN', 'STEMPELPLATTE', 'TRODAT_KISSEN'] as const
type ExtraTyp = (typeof EXTRA_TYPEN)[number]
type AnyTyp = StempelTeiltyp | ExtraTyp

const NACHFUELLFARBE_FARBEN = ['SCHWARZ', 'ROT', 'BLAU', 'GRUEN'] as const
const NACHFUELLFARBE_TINTE_TYP = ['NORMAL', 'HAUTVERTRAEGLICH', 'TEXTIL'] as const
const STEMPELKISSEN_GROESSE = ['KLEIN', 'MITTEL', 'GROSS'] as const

export function validateStempelDetail(
  typ: string | null,
  d: StempelDetailJson,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  const isKnownTyp =
    !!typ && ((STEMPEL_TYPEN as readonly string[]).includes(typ) || (EXTRA_TYPEN as readonly string[]).includes(typ))
  if (!typ || !isKnownTyp) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  const t = typ as AnyTyp

  // Anzahl / Stückzahl
  if (t === 'TRODAT_KISSEN') {
    if (!stueckzahlGueltig(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  } else {
    if (!anzahlGueltig(d)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  }

  // Maße (OR-Pflicht) für alle außer NACHFUELLFARBE, STEMPELKISSEN, TRODAT_KISSEN
  const needsFormat = t !== 'NACHFUELLFARBE' && t !== 'STEMPELKISSEN' && t !== 'TRODAT_KISSEN'
  if (needsFormat) {
    const b = positiveGanzzahlOrNull(d.format_breite)
    const h = positiveGanzzahlOrNull(d.format_hoehe)
    const hasOne = (b ?? 0) > 0 || (h ?? 0) > 0
    if (!hasOne) f(o, 'format', 'Mindestens Breite oder Höhe angeben')
    if (d.format_breite != null && d.format_breite !== '' && b == null) f(o, 'format_breite', 'Ganze Zahl > 0')
    if (d.format_hoehe != null && d.format_hoehe !== '' && h == null) f(o, 'format_hoehe', 'Ganze Zahl > 0')
  }

  // Typ-spezifische Pflichtfelder
  if (t === 'NACHFUELLFARBE') {
    const fr = reqEnum(d.farbe, NACHFUELLFARBE_FARBEN)
    if (!fr) f(o, 'farbe', 'Pflichtfeld')
    const tt = reqEnum(d.tinte_typ, NACHFUELLFARBE_TINTE_TYP)
    if (!tt) f(o, 'tinte_typ', 'Pflichtfeld')
  } else if (t === 'STEMPELKISSEN') {
    const gr = reqEnum(d.groesse, STEMPELKISSEN_GROESSE)
    if (!gr) f(o, 'groesse', 'Pflichtfeld')
    const fr = reqEnum(d.farbe, NACHFUELLFARBE_FARBEN)
    if (!fr) f(o, 'farbe', 'Pflichtfeld')
  } else if (t === 'TRODAT_KISSEN') {
    if (!reqStr((d as Record<string, unknown>).kissen_artikelnummer)) f(o, 'kissen_artikelnummer', 'Pflichtfeld')
    const fr = reqEnum(d.farbe, NACHFUELLFARBE_FARBEN)
    if (!fr) f(o, 'farbe', 'Pflichtfeld')
    if (!reqStr((d as Record<string, unknown>).kissen_modell_id)) f(o, 'kissen_modell_id', 'Farb-Variante wählen')
  } else if (t === 'STEMPELPLATTE') {
    // Keine Farbe, keine Beschreibung.
  } else {
    // Standard-Stempel: Farbe + Beschreibung
    const fr = reqStr(d.farbe) as StempelFarbe | null
    if (!fr || !STEMPEL_FARBE.includes(fr as StempelFarbe)) f(o, 'farbe', 'Pflichtfeld')
    if (fr === 'SONSTIGE' && !reqStr(d.farbe_sonstige)) f(o, 'farbe_sonstige', 'Pflichtfeld')
    if (!reqStr(d.beschreibung)) f(o, 'beschreibung', 'Pflichtfeld')
  }
  return o
}
