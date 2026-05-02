import { LFP_TEILTYPEN, type LfpDetailJson, type LfpTeiltyp } from '../../types/lfp'
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

function zahlMm(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function datumIso(v: unknown): string | null {
  if (v == null) return null
  if (typeof v !== 'string' || v.trim() === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return v.slice(0, 10)
}

/** Mindestens ein Maß (Breite oder Höhe) &gt; 0 */
function masseErfuellt(b: unknown, h: unknown): boolean {
  return zahlMm(b) != null || zahlMm(h) != null
}

function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

function posIntMm(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

const MSG_MASSE = 'Mindestens Breite oder Höhe angeben'

export function validateLfpDetail(
  typ: string | null,
  d: LfpDetailJson,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!typ || !LFP_TEILTYPEN.includes(typ as LfpTeiltyp)) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  if (!stueckzahlGueltig(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')

  const t = typ as LfpTeiltyp
  if (t === 'AUFKLEBER') {
    if (!['3551', 'ULTRATACK', 'MONSTERTACK', '3162'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['FREIFORM', 'RECHTECK'].includes(reqStr(d.konturschnitt) ?? '')) f(o, 'konturschnitt', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(reqStr(d.laminat) ?? '')) f(o, 'laminat', 'Pflichtfeld')
    if (!['EINZEL', 'BOGEN'].includes(reqStr(d.ausgabe) ?? '')) f(o, 'ausgabe', 'Pflichtfeld')
    if (!masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  } else if (t === 'SCHILD_UV') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(reqStr(d.druckseite) ?? '')) f(o, 'druckseite', 'Pflichtfeld')
    if (d.material === 'ACRYLGLAS') {
      if (!['VORDERSEITE', 'RUECKSEITE'].includes(reqStr(d.acryl_druckrichtung) ?? '')) f(o, 'acryl_druckrichtung', 'Pflichtfeld')
    }
    if (reqBool(d.ecken_runden) === 'missing') f(o, 'ecken_runden', 'Pflichtfeld')
    if (reqBool(d.bohrungen) === 'missing') f(o, 'bohrungen', 'Pflichtfeld')
    if (d.bohrungen === true) {
      if (posIntMm(d.bohrungen_durchmesser) == null) f(o, 'bohrungen_durchmesser', 'Ganze Zahl (mm) ≥ 1')
      if (!reqStr(d.bohrungen_position)) f(o, 'bohrungen_position', 'Pflichtfeld')
    }
    if (!masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  } else if (t === 'SCHILD_FOLIE') {
    if (!['ALUVERBUND', 'PVC', 'ACRYLGLAS'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['EINSEITIG', 'BEIDSEITIG'].includes(reqStr(d.druckseite) ?? '')) f(o, 'druckseite', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(reqStr(d.laminat) ?? '')) f(o, 'laminat', 'Pflichtfeld')
    if (reqBool(d.ecken_runden) === 'missing') f(o, 'ecken_runden', 'Pflichtfeld')
    if (reqBool(d.bohrungen) === 'missing') f(o, 'bohrungen', 'Pflichtfeld')
    if (d.bohrungen === true) {
      if (posIntMm(d.bohrungen_durchmesser) == null) f(o, 'bohrungen_durchmesser', 'Ganze Zahl (mm) ≥ 1')
      if (!reqStr(d.bohrungen_position)) f(o, 'bohrungen_position', 'Pflichtfeld')
    }
    if (!masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  } else if (t === 'FOLIENPLOTT') {
    if (!['751C', '631', '8510'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['EINZEL', 'BOGEN'].includes(reqStr(d.ausgabe) ?? '')) f(o, 'ausgabe', 'Pflichtfeld')
  } else if (t === 'BANNER') {
    if (!['PVC_FRONTLIT', 'MESH', 'BAUZAUNBANNER'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
    if (reqBool(d.saum) === 'missing') f(o, 'saum', 'Pflichtfeld')
    if (reqBool(d.oesen) === 'missing') f(o, 'oesen', 'Pflichtfeld')
    if (d.oesen === true) {
      if (!reqStr(d.oesen_detail)) f(o, 'oesen_detail', 'Pflichtfeld')
    }
  } else if (t === 'ROLLUP') {
    if (!['PVC_FRONTLIT', 'ROLLUP_FILM'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['NEUE_KASSETTE', 'MOTIVTAUSCH'].includes(reqStr(d.system) ?? '')) f(o, 'system', 'Pflichtfeld')
    const br = Number(d.breite)
    if (br !== 85 && br !== 100) f(o, 'breite', 'Breite 85 oder 100 cm wählen')
  } else if (t === 'FAHRZEUGBESCHRIFTUNG') {
    if (!reqStr(d.marke)) f(o, 'marke', 'Pflichtfeld')
    if (!reqStr(d.modell)) f(o, 'modell', 'Pflichtfeld')
    if (reqBool(d.bereiche_seiten) === 'missing') f(o, 'bereiche_seiten', 'Pflichtfeld')
    if (reqBool(d.bereiche_front) === 'missing') f(o, 'bereiche_front', 'Pflichtfeld')
    if (reqBool(d.bereiche_heck) === 'missing') f(o, 'bereiche_heck', 'Pflichtfeld')
    if (!['MIT', 'OHNE'].includes(reqStr(d.montage) ?? '')) f(o, 'montage', 'Pflichtfeld')
    if (d.montage === 'MIT' && reqBool(d.altbeklebung) === 'missing') f(o, 'altbeklebung', 'Pflichtfeld')
    if (d.montage === 'MIT' && !datumIso(d.montagetermin)) f(o, 'montagetermin', 'Gültiges Datum')
  } else if (t === 'SONSTIGE_LFP') {
    if (!reqStr(d.beschreibung)) f(o, 'beschreibung', 'Pflichtfeld')
  }
  return o
}
