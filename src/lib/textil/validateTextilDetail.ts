import type {
  TextilGroesseEnum,
  TextilMotiveRow,
  TextilPositionenRow,
  TextilZuordnungRow,
} from '../../types/textil'

const GROESSE_NORM: TextilGroesseEnum[] = ['KLEIN', 'MITTEL', 'GROSS', 'FREI']

export function textilDetailJsonMarkiertVoll(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return false
  const t = (detail as { textil?: { voll?: boolean } }).textil
  if (!t || typeof t !== 'object') return false
  return t.voll === true
}

function groesseIstGesetzt(g: string | null | undefined): boolean {
  if (g == null) return false
  const s = String(g).trim()
  if (!s) return false
  if (GROESSE_NORM.includes(s as TextilGroesseEnum)) return true
  if (s.startsWith('FREI:')) {
    return s.length > 5
  }
  return false
}

function zuordnungDatensatzVoll(z: { motiv_id: string; position_id: string }): boolean {
  return Boolean(z.motiv_id?.trim() && z.position_id?.trim())
}

/**
 * Erfüllt die fachlichen Voraussetzungen für auto. PREPRESS (ohne Kundenkontakt).
 * Motive, Positionen, mind. eine Zuordnung, jede Zuordnung vollständig.
 */
export function textilDatensaetzeErlaubenPraepress(
  motive: TextilMotiveRow[],
  positionen: TextilPositionenRow[],
  zuordnungen: Pick<TextilZuordnungRow, 'motiv_id' | 'position_id'>[]
): boolean {
  if (motive.length < 1 || positionen.length < 1) return false
  if (zuordnungen.length < 1) return false
  for (const z of zuordnungen) {
    if (!zuordnungDatensatzVoll(z)) return false
  }
  for (const m of motive) {
    if (!m.platz?.trim()) return false
    if (!groesseIstGesetzt(m.groesse)) return false
    if (m.typ === 'TEXT') {
      if (!m.inhalt?.trim() || !m.farbe?.trim() || !m.schriftklasse?.trim()) return false
    } else {
      if (!m.datei_id) return false
    }
  }
  for (const p of positionen) {
    if (p.stueckzahl < 1 || !Number.isInteger(p.stueckzahl)) return false
    if (p.herkunft === 'KUNDENWARE') {
      if (!p.typ?.trim() || !p.farbe?.trim()) return false
    } else {
      if (!p.marke?.trim() || !p.modell?.trim() || !p.farbe?.trim() || !p.groesse?.trim()) return false
    }
  }
  return true
}

export function buildFreiGroesseString(mm: string): string {
  return `FREI:${mm.trim()}`
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return (error.message ?? '').toLowerCase().includes('unique')
}
