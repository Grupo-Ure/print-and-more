import type { AuftragStatus } from '../../types/database'

function reqStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

/** Wenn gesetzt: ganze Zahl ≥ 1. Leer/null/undefined = gültig (optional). */
function stueckzahlOptional(v: unknown): boolean {
  if (v == null || v === '') return true
  if (typeof v === 'number' && Number.isNaN(v)) return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (Number.isNaN(n)) return false
  return Number.isInteger(n) && n >= 1
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

export function validateSonstigeDetail(
  d: Record<string, unknown> | null,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!reqStr(d?.beschreibung)) f(o, 'beschreibung', 'Pflichtfeld')
  if (d && !stueckzahlOptional(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  return o
}
