import {
  LASER_HERKUNFT,
  LASER_MAT_SCHILD,
  type LaserTeiltyp,
  LASER_TYPEN,
} from '../../types/laser'
import type { AuftragStatus } from '../../types/database'

function reqStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

function reqBool(v: unknown): 'ok' | 'missing' {
  if (v === true || v === false) return 'ok'
  return 'missing'
}

function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

/** Positive Ganzzahl mm, oder leer. */
function posGanzzahlMm(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

function formatMindestEins(b: unknown, h: unknown): boolean {
  return posGanzzahlMm(b) != null || posGanzzahlMm(h) != null
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

const MSG_FORMAT_MASSE = 'Mindestens Breite oder Höhe angeben'

export function validateLaserDetail(
  typ: string | null,
  d: Record<string, unknown> | null,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!typ || !LASER_TYPEN.includes(typ as LaserTeiltyp)) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  if (!stueckzahlGueltig(d?.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')

  const t = typ as LaserTeiltyp

  if (t === 'SCHILD' || t === 'POKALSCHILD' || t === 'NAMENSSCHILD') {
    const m = reqStr(d?.material) as (typeof LASER_MAT_SCHILD)[number] | null
    if (!m || !LASER_MAT_SCHILD.includes(m as (typeof LASER_MAT_SCHILD)[number])) {
      f(o, 'material', 'Pflichtfeld')
    }
    if (m === 'SONSTIGE' && !reqStr(d?.material_sonstige)) f(o, 'material_sonstige', 'Pflichtfeld')
    if (!formatMindestEins(d?.format_breite, d?.format_hoehe)) f(o, 'format_masse', MSG_FORMAT_MASSE)
    if (reqBool(d?.ecken_runden) === 'missing') f(o, 'ecken_runden', 'Pflichtfeld')
    if ((t === 'SCHILD' || t === 'POKALSCHILD') && reqBool(d?.selbstklebend) === 'missing') {
      f(o, 'selbstklebend', 'Pflichtfeld')
    }
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  } else if (t === 'GESCHENKARTIKEL') {
    if (!reqStr(d?.material_freitext)) f(o, 'material_freitext', 'Pflichtfeld')
    const h = reqStr(d?.herkunft)
    if (!h || !LASER_HERKUNFT.includes(h as (typeof LASER_HERKUNFT)[number])) f(o, 'herkunft', 'Pflichtfeld')
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  } else if (t === 'SONSTIGE_LASER') {
    if (reqBool(d?.selbstklebend) === 'missing') f(o, 'selbstklebend', 'Pflichtfeld')
    const h = reqStr(d?.herkunft)
    if (!h || !LASER_HERKUNFT.includes(h as (typeof LASER_HERKUNFT)[number])) f(o, 'herkunft', 'Pflichtfeld')
    if (!reqStr(d?.motiv)) f(o, 'motiv', 'Pflichtfeld')
  }

  return o
}
