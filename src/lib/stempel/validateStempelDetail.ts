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

function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

export function validateStempelDetail(
  typ: string | null,
  d: StempelDetailJson,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!typ || !STEMPEL_TYPEN.includes(typ as StempelTeiltyp)) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  if (!stueckzahlGueltig(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  const fr = reqStr(d.farbe) as StempelFarbe | null
  if (!fr || !STEMPEL_FARBE.includes(fr as StempelFarbe)) f(o, 'farbe', 'Pflichtfeld')
  if (fr === 'SONSTIGE' && !reqStr(d.farbe_sonstige)) f(o, 'farbe_sonstige', 'Pflichtfeld')
  if (!reqStr(d.beschreibung)) f(o, 'beschreibung', 'Pflichtfeld')
  return o
}
