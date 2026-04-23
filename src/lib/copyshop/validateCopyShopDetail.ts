import { COPY_SHOP_TYPS, type CopyShopDetailJson, type CopyShopTeiltyp } from '../../types/copyshop'
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

function masseErfuellt(b: unknown, h: unknown): boolean {
  return zahlMm(b) != null || zahlMm(h) != null
}

const MSG_MASSE = 'Mindestens Breite oder Höhe angeben'

function stueckzahlGueltig(v: unknown): boolean {
  if (v == null || v === '') return false
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isInteger(n) && n >= 1
}

function intMin(v: unknown, min: number): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isInteger(n) || n < min) return null
  return n
}

type Err = Record<string, string>
const f = (o: Err, k: string, m: string) => {
  o[k] = m
}

const CC_G = ['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'] as const

function valCcPaar(d: CopyShopDetailJson, o: Err, kM: string, kS: string) {
  const m = reqStr((d as Record<string, unknown>)[kM] as string)
  if (!m || !(CC_G as readonly string[]).includes(m)) f(o, kM, 'Pflichtfeld')
  if (m === 'SONSTIGE' && !reqStr((d as Record<string, unknown>)[kS] as string)) f(o, kS, 'Pflichtfeld')
}

function valKarteFalzFormat(istFalz: boolean, d: CopyShopDetailJson, o: Err) {
  const fmt = reqStr((d as Record<string, string>).format)
  const karteOk = [
    'DIN_LANG',
    'A7',
    'A6',
    'A5',
    'A4',
    'A3',
    'FREI',
  ]
  const falzOk = ['DIN_LANG', 'A7', 'A6', 'A5', 'A4', 'FREI']
  if (istFalz) {
    if (!falzOk.includes(fmt ?? '')) f(o, 'format', 'Pflichtfeld')
  } else {
    if (!karteOk.includes(fmt ?? '')) f(o, 'format', 'Pflichtfeld')
  }
  if (fmt === 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  else if (fmt && fmt !== 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
}

function valMaterialOffsetKarteFalz(d: CopyShopDetailJson, o: Err) {
  const oa = reqStr((d as Record<string, string>).offset_art)
  if (!['STANDARD', 'OFFSET', 'SPEZIAL'].includes(oa ?? '')) f(o, 'offset_art', 'Pflichtfeld')
  if (oa === 'STANDARD') {
    if (!['115G', '135G', '170G', '250G', '300G', '350G', '400G'].includes(reqStr((d as Record<string, string>).offset_grammatur) ?? '')) {
      f(o, 'offset_grammatur', 'Pflichtfeld')
    }
    if (!['MATT', 'GLAENZEND'].includes(reqStr((d as Record<string, string>).offset_oberflaeche) ?? '')) {
      f(o, 'offset_oberflaeche', 'Pflichtfeld')
    }
  } else if (oa === 'OFFSET') {
    if (!['80G', '90G', '100G', '120G', '150G', '250G'].includes(reqStr((d as Record<string, string>).offset_grammatur) ?? '')) {
      f(o, 'offset_grammatur', 'Pflichtfeld')
    }
  } else if (oa === 'SPEZIAL') {
    const sp = reqStr((d as Record<string, string>).spezial_papier)
    if (!['300G_FOLIENKASCHIERT', 'RECYCLING', '250G_LEINENSTRUKTUR', 'SONSTIGE'].includes(sp ?? '')) {
      f(o, 'spezial_papier', 'Pflichtfeld')
    } else if (sp === '300G_FOLIENKASCHIERT') {
      if (!['MATT', 'GLAENZEND'].includes(reqStr((d as Record<string, string>).kaschierung) ?? '')) f(o, 'kaschierung', 'Pflichtfeld')
      if (!['EINSEITIG', 'BEIDSEITIG'].includes(reqStr((d as Record<string, string>).kaschierung_seiten) ?? '')) {
        f(o, 'kaschierung_seiten', 'Pflichtfeld')
      }
    } else if (sp === 'RECYCLING') {
      if (!['80G', '135G', '150G', '300G'].includes(reqStr((d as Record<string, string>).recycling_grammatur) ?? '')) {
        f(o, 'recycling_grammatur', 'Pflichtfeld')
      }
    } else if (sp === 'SONSTIGE') {
      if (!reqStr((d as Record<string, string>).spezial_sonstige)) f(o, 'spezial_sonstige', 'Pflichtfeld')
    }
  }
}

function valBroschOffsetOderOffen(d: CopyShopDetailJson, o: Err) {
  if (
    !['DRAHTHEFTUNG', 'RINGSÖSEN', 'KLEBEBINDUNG', 'SPIRALBINDUNG'].includes(
      reqStr((d as Record<string, string>).brosch_bindung) ?? '',
    )
  ) {
    f(o, 'brosch_bindung', 'Pflichtfeld')
  }
  if (!['135G', '170G', '250G', '300G'].includes(reqStr((d as Record<string, string>).brosch_u_gramm) ?? '')) {
    f(o, 'brosch_u_gramm', 'Pflichtfeld')
  }
  if (!['MATT', 'GLAENZEND'].includes(reqStr((d as Record<string, string>).brosch_u_ober) ?? '')) {
    f(o, 'brosch_u_ober', 'Pflichtfeld')
  }
  if (!['90G', '135G', '170G'].includes(reqStr((d as Record<string, string>).brosch_i_gramm) ?? '')) {
    f(o, 'brosch_i_gramm', 'Pflichtfeld')
  }
  if (!['MATT', 'GLAENZEND'].includes(reqStr((d as Record<string, string>).brosch_i_ober) ?? '')) {
    f(o, 'brosch_i_ober', 'Pflichtfeld')
  }
}

function valFalzSeitenzahl(d: CopyShopDetailJson, o: Err) {
  const sz = intMin(d.seitenzahl, 2)
  if (sz == null) f(o, 'seitenzahl', 'Pflichtfeld')
  else if (sz > 100) f(o, 'seitenzahl', 'Max. 100')
  else if (sz % 2 !== 0) f(o, 'seitenzahl', 'Nur gerade Zahl (2–100)')
}

function valBroschSeitenzahl(d: CopyShopDetailJson, o: Err) {
  const sz = intMin(d.seitenzahl, 4)
  if (sz == null) f(o, 'seitenzahl', 'Pflichtfeld')
  else if (sz > 152) f(o, 'seitenzahl', 'Max. 152')
  else if (sz % 4 !== 0) f(o, 'seitenzahl', 'Seitenzahl muss durch 4 teilbar sein')
}

function valBroschFormat(d: CopyShopDetailJson, o: Err) {
  const fmt = reqStr((d as Record<string, string>).format)
  if (!['A6', 'A5', 'A4', 'FREI'].includes(fmt ?? '')) f(o, 'format', 'Pflichtfeld')
  if (fmt === 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  else if (fmt && fmt !== 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
}

function farbePassendZuBindung(ba: string | null, col: string | null): boolean {
  if (!ba || !col) return false
  const sets: Record<string, string[]> = {
    WIRE_O: ['SCHWARZ', 'SILBER'],
    KUNSTSTOFFSPIRALE: ['SCHWARZ', 'WEISS'],
    SOFTCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
    HARDCOVER: ['SCHWARZ', 'DUNKELBLAU', 'DUNKELROT'],
  }
  return sets[ba]?.includes(col) ?? false
}

export function validateCopyShopDetail(
  typ: string | null,
  d: CopyShopDetailJson,
  teilStatus: AuftragStatus
): Record<string, string> {
  const o: Err = {}
  if (teilStatus === 'ANGEBOT') return o
  if (!typ || !COPY_SHOP_TYPS.includes(typ as CopyShopTeiltyp)) {
    f(o, 'typ', 'Typ wählen')
    return o
  }
  if (!stueckzahlGueltig(d.stueckzahl)) f(o, 'stueckzahl', 'Ganze Zahl ≥ 1')
  const t = typ as CopyShopTeiltyp
  const pw = d.produktionsweg
  if (t === 'KARTE_FLYER' || t === 'FALZFLYER' || t === 'BROSCHUERE') {
    if (!['CC', 'OFFSET', 'OFFEN'].includes(reqStr(pw) ?? '')) f(o, 'produktionsweg', 'Pflichtfeld')
  } else if (t !== 'PLAKAT_POSTER' && t !== 'AUSDRUCK' && t !== 'VISITENKARTE' && t !== 'BINDUNG') {
    if (pw != null && pw !== '' && pw !== 'COPYSHOP' && pw !== 'OFFSET') f(o, 'produktionsweg', 'Ungültig')
  }

  if (t === 'PLAKAT_POSTER') {
    const plakatFmt = reqStr((d as Record<string, string>).format)
    if (!['A4', 'A3', 'A2', 'A1', 'A0', 'FREI'].includes(plakatFmt ?? '')) f(o, 'format', 'Pflichtfeld')
    if (!['120G_AFFICHEN', '200G_SEIDENGLANZ', '200G_GLANZ'].includes(reqStr(d.material) ?? '')) f(o, 'material', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(reqStr(d.laminat) ?? '')) f(o, 'laminat', 'Pflichtfeld')
    if (plakatFmt === 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
    else if (plakatFmt && plakatFmt !== 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
  } else if (t === 'KARTE_FLYER') {
    if (!['1_0', '1_1', '4_0', '4_4'].includes(reqStr(d.farbigkeit) ?? '')) f(o, 'farbigkeit', 'Pflichtfeld')
    valKarteFalzFormat(false, d, o)
    if (reqBool(d.randabfallend) === 'missing') f(o, 'randabfallend', 'Pflichtfeld')
    const pws = reqStr(pw)
    if (pws === 'CC') {
      valCcPaar(d, o, 'material_cc', 'material_cc_sonstige')
    } else if (pws === 'OFFSET') {
      valMaterialOffsetKarteFalz(d, o)
    }
  } else if (t === 'FALZFLYER') {
    if (!['1_1', '4_4'].includes(reqStr(d.farbigkeit) ?? '')) f(o, 'farbigkeit', 'Pflichtfeld')
    if (!['MITTELFALZ', 'WICKELFALZ', 'ZICKZACK'].includes(reqStr(d.falzart) ?? '')) f(o, 'falzart', 'Pflichtfeld')
    valKarteFalzFormat(true, d, o)
    valFalzSeitenzahl(d, o)
    if (reqBool(d.randabfallend) === 'missing') f(o, 'randabfallend', 'Pflichtfeld')
    const pws = reqStr(pw)
    if (pws === 'CC') {
      valCcPaar(d, o, 'material_cc', 'material_cc_sonstige')
    } else if (pws === 'OFFSET') {
      valMaterialOffsetKarteFalz(d, o)
    }
  } else if (t === 'BROSCHUERE') {
    valBroschFormat(d, o)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(reqStr((d as Record<string, string>).orientierung) ?? '')) {
      f(o, 'orientierung', 'Pflichtfeld')
    }
    valBroschSeitenzahl(d, o)
    const pws = reqStr(pw)
    const orient = reqStr((d as Record<string, string>).orientierung)
    if (orient === 'QUERFORMAT' && pws === 'CC') {
      f(o, 'brosch_quer_cc', 'Querformat nur bei Offset oder Offen möglich')
    }
    if (pws === 'CC') {
      valCcPaar(d, o, 'cc_umschlag', 'cc_umschlag_sonstige')
      valCcPaar(d, o, 'cc_inhalt', 'cc_inhalt_sonstige')
    } else if (pws === 'OFFSET' || pws === 'OFFEN') {
      valBroschOffsetOderOffen(d, o)
    }
    if (reqBool(d.randabfallend) === 'missing') f(o, 'randabfallend', 'Pflichtfeld')
  } else if (t === 'VISITENKARTE') {
    const mat = reqStr((d as Record<string, string>).material)
    const visitMat = [
      '300G_CC',
      '350G_OFFSET',
      '400G_OFFSET',
      '300G_RECYCLING',
      '250G_LEINENSTRUKTUR',
      'MULTILOFT',
    ]
    if (!mat || !visitMat.includes(mat)) f(o, 'material', 'Pflichtfeld')
    if (!['4_0', '4_4'].includes(reqStr(d.farbigkeit) ?? '')) f(o, 'farbigkeit', 'Pflichtfeld')
    if (!['1_SEITIG', '2_SEITIG'].includes(reqStr((d as Record<string, string>).druckseite) ?? '')) {
      f(o, 'druckseite', 'Pflichtfeld')
    }
    const fmt = reqStr((d as Record<string, string>).format)
    if (!['STANDARD_85_55', 'STANDARD_90_50', 'FREI'].includes(fmt ?? '')) f(o, 'format', 'Pflichtfeld')
    if (fmt === 'FREI' && !masseErfuellt(d.format_breite, d.format_hoehe)) f(o, 'format_masse', MSG_MASSE)
    if (!['HOCHFORMAT', 'QUERFORMAT'].includes(reqStr((d as Record<string, string>).orientierung) ?? '')) {
      f(o, 'orientierung', 'Pflichtfeld')
    }
    if (mat === '350G_OFFSET' && reqBool((d as Record<string, unknown>).folienkaschiert) === 'missing') {
      f(o, 'folienkaschiert', 'Pflichtfeld')
    }
    if (mat === 'MULTILOFT') {
      const fk = [
        'SCHWARZ',
        'ELFENBEIN',
        'WEISS',
        'ROT',
        'OLIVGRUEN',
        'HELLGRUEN',
        'TUERKIS',
        'LILA',
        'GELB',
        'ORANGE',
        'MAGENTA',
        'ROSA',
        'BLAU',
      ]
      if (!fk.includes(reqStr((d as Record<string, string>).multiloft_farbkern) ?? '')) f(o, 'multiloft_farbkern', 'Pflichtfeld')
    }
    if (reqBool(d.randabfallend) === 'missing') f(o, 'randabfallend', 'Pflichtfeld')
  } else if (t === 'BINDUNG') {
    const m = reqStr((d as Record<string, string>).material)
    if (!['80G', '100G', '120G', 'SONSTIGE'].includes(m ?? '')) f(o, 'material', 'Pflichtfeld')
    if (m === 'SONSTIGE' && !reqStr((d as Record<string, string>).material_sonstige)) f(o, 'material_sonstige', 'Pflichtfeld')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(reqStr(d.farbigkeit) ?? '')) f(o, 'farbigkeit', 'Pflichtfeld')
    const ba = reqStr(d.bindungsart) as 'WIRE_O' | 'KUNSTSTOFFSPIRALE' | 'SOFTCOVER' | 'HARDCOVER' | null
    if (!['WIRE_O', 'KUNSTSTOFFSPIRALE', 'SOFTCOVER', 'HARDCOVER'].includes(ba ?? '')) f(o, 'bindungsart', 'Pflichtfeld')
    const bcf = reqStr(d.bindungsart_farbe)
    if (!ba || !bcf || !farbePassendZuBindung(ba, bcf)) f(o, 'bindungsart_farbe', 'Pflichtfeld')
    if (ba === 'WIRE_O' || ba === 'KUNSTSTOFFSPIRALE') {
      const ffmt = reqStr((d as Record<string, string>).format)
      if (!['A5', 'A4', 'A3', 'FREI'].includes(ffmt ?? '')) f(o, 'format', 'Pflichtfeld')
      const orient = reqStr((d as Record<string, string>).orientierung)
      if (ffmt === 'A5' || ffmt === 'A4') {
        if (!['HOCHFORMAT', 'QUERFORMAT'].includes(orient ?? '')) f(o, 'orientierung', 'Pflichtfeld')
      }
      if (ffmt === 'A3' && orient !== 'QUERFORMAT') f(o, 'orientierung', 'A3 nur Querformat')
      if (ffmt === 'FREI') {
        const hh = zahlMm(d.format_hoehe)
        if (hh != null && hh > 300) f(o, 'format_hoehe', 'Höhe max. 300 mm (Bindungskante)')
      }
    } else if (ba === 'SOFTCOVER' || ba === 'HARDCOVER') {
      if (reqStr((d as Record<string, string>).format) !== 'A4') f(o, 'format', 'A4 Hochformat 210×297 mm')
      else if (reqStr((d as Record<string, string>).orientierung) !== 'HOCHFORMAT') {
        f(o, 'orientierung', 'Pflichtfeld')
      } else {
        const b = zahlMm(d.format_breite)
        const h = zahlMm(d.format_hoehe)
        if (b == null || h == null || Math.abs(b - 210) > 0.5 || Math.abs(h - 297) > 0.5) {
          f(o, 'format', 'A4 Hochformat 210×297 mm')
        }
      }
    }
    if (ba === 'HARDCOVER') {
      if (reqBool((d as Record<string, unknown>).hardcover_druck) === 'missing') f(o, 'hardcover_druck', 'Pflichtfeld')
      if (d.hardcover_druck === true && !reqStr((d as Record<string, string>).hardcover_einband)) {
        f(o, 'hardcover_einband', 'Pflichtfeld')
      }
    }
    if (reqBool(d.randabfallend) === 'missing') f(o, 'randabfallend', 'Pflichtfeld')
  } else if (t === 'AUSDRUCK') {
    if (!['A5', 'A4', 'A3'].includes(reqStr((d as Record<string, string>).format) ?? '')) f(o, 'format', 'Pflichtfeld')
    const m = reqStr((d as Record<string, string>).material)
    if (!['80G', '100G', '120G', '160G', '200G', '250G', '300G', 'SONSTIGE'].includes(m ?? '')) f(o, 'material', 'Pflichtfeld')
    if (m === 'SONSTIGE' && !reqStr((d as Record<string, string>).material_sonstige)) f(o, 'material_sonstige', 'Pflichtfeld')
    if (!['1_0', '1_1', '4_0', '4_1'].includes(reqStr(d.farbigkeit) ?? '')) f(o, 'farbigkeit', 'Pflichtfeld')
    if (!['NEIN', '2_LOCH', '4_LOCH'].includes(reqStr(d.lochen) ?? '')) f(o, 'lochen', 'Pflichtfeld')
    if (reqBool(d.heften) === 'missing') f(o, 'heften', 'Pflichtfeld')
    if (!['NEIN', 'MATT', 'GLAENZEND'].includes(reqStr(d.laminieren) ?? '')) f(o, 'laminieren', 'Pflichtfeld')
  }
  return o
}
