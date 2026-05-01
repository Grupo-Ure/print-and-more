import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDatumDe } from '../formatDatum'
import { supabase } from '../../supabase'
import type { Database } from '../../types/supabase'

type AuftragPdfRow = Pick<
  Database['public']['Tables']['auftraege']['Row'],
  'auftragsnummer' | 'termin' | 'lieferung' | 'prioritaet' | 'erstellt_am'
> & {
  kunden:
    | Database['public']['Tables']['kunden']['Row']
    | Database['public']['Tables']['kunden']['Row'][]
    | null
}

type TeilauftragRow = Database['public']['Tables']['teilauftraege']['Row']
type TextilPositionRow = Database['public']['Tables']['textil_positionen']['Row']

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } }

const KNOWN_DETAIL_KEYS: string[] = [
  'typ',
  'stueckzahl',
  'material',
  'material_freitext',
  'material_sonstige',
  'format_breite',
  'format_hoehe',
  'ecken_runden',
  'selbstklebend',
  'motiv',
  'herkunft',
  'besonderheiten',
  'beschreibung',
]

function asDetailRecord(detail: unknown): Record<string, unknown> {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return detail as Record<string, unknown>
  }
  return {}
}

function detailZeilen(detail: Record<string, unknown>): { label: string; wert: string }[] {
  const d = asDetailRecord(detail)
  const keys = Object.keys(d).filter(k => k !== 'hat_produkte' && k !== 'datei_id')
  const ordered = [
    ...KNOWN_DETAIL_KEYS.filter(k => keys.includes(k)),
    ...keys.filter(k => !KNOWN_DETAIL_KEYS.includes(k)).sort(),
  ]

  const out: { label: string; wert: string }[] = []
  for (const key of ordered) {
    const val = d[key]
    const pair = detailEintraeg(key, val)
    if (pair) out.push(pair)
  }
  return out
}

function feldZuLabel(key: string): string {
  switch (key) {
    case 'typ':
      return 'Typ'
    case 'stueckzahl':
      return 'Stückzahl'
    case 'material':
    case 'material_freitext':
      return 'Material'
    case 'material_sonstige':
      return 'Material (Sonstige)'
    case 'format_breite':
      return 'Breite (mm)'
    case 'format_hoehe':
      return 'Höhe (mm)'
    case 'ecken_runden':
      return 'Ecken runden'
    case 'selbstklebend':
      return 'Selbstklebend'
    case 'motiv':
      return 'Motiv / Inhalt'
    case 'herkunft':
      return 'Herkunft'
    case 'besonderheiten':
      return 'Besonderheiten'
    case 'beschreibung':
      return 'Beschreibung'
    default:
      return key
  }
}

function istLeer(val: unknown): boolean {
  return val === null || val === undefined || val === ''
}

function wertAlsString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'boolean') return val ? 'Ja' : 'Nein'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function detailEintraeg(key: string, val: unknown): { label: string; wert: string } | null {
  if (key === 'hat_produkte' || key === 'datei_id') return null
  if (istLeer(val)) return null

  if (key === 'ecken_runden' || key === 'selbstklebend') {
    if (val === true) return { label: feldZuLabel(key), wert: 'Ja' }
    if (val === false) return { label: feldZuLabel(key), wert: 'Nein' }
    return { label: feldZuLabel(key), wert: String(val) }
  }

  return { label: feldZuLabel(key), wert: wertAlsString(val) }
}

function extrahiereKunde(raw: AuftragPdfRow['kunden']): Database['public']['Tables']['kunden']['Row'] | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.length ? (raw[0] as Database['public']['Tables']['kunden']['Row']) : null
  return raw as Database['public']['Tables']['kunden']['Row']
}

function normalisiereDateinameSegment(s: string): string {
  let t = s.trim()
  const uml = [
    ['ä', 'ae'],
    ['ö', 'oe'],
    ['ü', 'ue'],
    ['ß', 'ss'],
    ['Ä', 'ae'],
    ['Ö', 'oe'],
    ['Ü', 'ue'],
  ] as const
  for (const [a, b] of uml) {
    t = t.split(a).join(b)
  }
  t = t.toLowerCase()
  t = t.replace(/\s+/g, '_')
  t = t.replace(/[^a-z0-9_-]/g, '')
  return t || 'kunde'
}

function jahrMonat(iso: string | null | undefined): string {
  if (!iso) return '0000-00'
  const m = iso.match(/^(\d{4})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '0000-00'
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${mo}`
}

function berechneDateiname(
  kundenname: string,
  termin: string | null | undefined,
  erstelltAm: string,
  bereich: string,
  auftragsnummer: string,
): string {
  const kn = normalisiereDateinameSegment(kundenname)
  const ym = jahrMonat(termin || erstelltAm)
  const typ = bereich.toLowerCase()
  const nr = normalisiereDateinameSegment(auftragsnummer) || auftragsnummer.toLowerCase().replace(/\s+/g, '_')
  return `${kn}_${ym}_${typ}_${nr}.pdf`
}

function formatLieferung(v: Database['public']['Enums']['lieferung_typ'] | null | undefined): string {
  if (v === 'ABHOLUNG') return 'Abholung'
  if (v === 'VERSAND') return 'Versand'
  return '—'
}

function formatPrioritaet(v: Database['public']['Enums']['prioritaet_typ']): string {
  if (v === 'HOCH') return '⚡ HOCH'
  return 'Normal'
}

function addText(
  doc: jsPDF,
  text: string,
  x: number,
  yPos: number,
  lineHeightMm: number,
  opts?: { align?: 'left' | 'center' | 'right' | 'justify'; maxWidth?: number },
): number {
  doc.text(text, x, yPos, opts)
  return yPos + lineHeightMm
}

function checkNewPage(doc: jsPDF, y: number, benoetigt = 20): number {
  if (y + benoetigt > 277) {
    doc.addPage()
    return 15
  }
  return y
}

function produktDetailSchluessel(produkte: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  const skip = new Set(['typ', 'hat_produkte', 'datei_id'])

  for (const row of produkte) {
    const detail = asDetailRecord(row.detail)
    for (const k of Object.keys(detail)) {
      if (skip.has(k)) continue
      if (!seen.has(k)) {
        seen.add(k)
        order.push(k)
      }
    }
  }
  return order
}

function zellenWertFuerSchluessel(row: Record<string, unknown>, key: string): string {
  const detail = asDetailRecord(row.detail)
  const val = detail[key]
  if (istLeer(val)) return ''
  if (key === 'ecken_runden' || key === 'selbstklebend') {
    if (val === true) return 'Ja'
    if (val === false) return 'Nein'
  }
  return wertAlsString(val)
}

export async function generiereUndLadePdf(teilauftragId: string, auftragId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabelle ggf. nicht in generierten Database-Typen
    const produkteQuery = (supabase as any)
      .from('teilauftrag_produkte')
      .select('*')
      .eq('teilauftrag_id', teilauftragId)
      .order('sort_order')

    const [auftragRes, teilRes, produkteRes, textilRes] = await Promise.all([
      supabase
        .from('auftraege')
        .select(
          'auftragsnummer, termin, lieferung, prioritaet, erstellt_am, kunden(name, strasse, hausnummer, plz, ort, email, telefon)',
        )
        .eq('id', auftragId)
        .single(),
      supabase.from('teilauftraege').select('*').eq('id', teilauftragId).single(),
      produkteQuery,
      supabase.from('textil_positionen').select('*').eq('teilauftrag_id', teilauftragId).order('id'),
    ])

    if (auftragRes.error) console.error(auftragRes.error)
    if (teilRes.error) console.error(teilRes.error)
    if (produkteRes.error) console.error(produkteRes.error)
    if (textilRes.error) console.error(textilRes.error)

    if (auftragRes.error || teilRes.error || produkteRes.error || textilRes.error) return

    const auftrag = auftragRes.data as AuftragPdfRow | null
    const teil = teilRes.data as TeilauftragRow | null
    if (!auftrag || !teil) return

    const produkte = (produkteRes.data ?? []) as Record<string, unknown>[]
    const textilPositionen = (textilRes.data ?? []) as TextilPositionRow[]

    const kunde = extrahiereKunde(auftrag.kunden)
    const kundenname = kunde?.name?.trim() ? kunde.name.trim() : 'Unbekannt'

    const dateiname = berechneDateiname(
      kundenname,
      auftrag.termin,
      auftrag.erstellt_am,
      teil.bereich,
      auftrag.auftragsnummer,
    )

    const marginL = 15
    const marginR = 15
    const marginT = 15

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    let y = marginT

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(0)
    y = addText(doc, `AUFTRAG ${auftrag.auftragsnummer}`, marginL, y, 8)
    doc.setFont('helvetica', 'normal')

    doc.setDrawColor(60)
    doc.line(marginL, y, 210 - marginR, y)
    y += 5

    let yLinks = y
    let yRechts = y

    doc.setFontSize(8)
    doc.setTextColor(120)
    yLinks = addText(doc, 'Kunde', marginL, yLinks, 4)
    doc.setTextColor(0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    yLinks = addText(doc, kundenname, marginL, yLinks, 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    if (kunde?.strasse || kunde?.hausnummer) {
      const str = [kunde.strasse, kunde.hausnummer].filter(Boolean).join(' ')
      yLinks = addText(doc, str, marginL, yLinks, 5)
    }
    if (kunde?.plz || kunde?.ort) {
      const ortZeile = [kunde.plz, kunde.ort].filter(Boolean).join(' ')
      if (ortZeile) yLinks = addText(doc, ortZeile, marginL, yLinks, 5)
    }
    if (kunde?.email) yLinks = addText(doc, kunde.email, marginL, yLinks, 5)
    if (kunde?.telefon) yLinks = addText(doc, kunde.telefon, marginL, yLinks, 5)

    const xRechts = 120
    doc.setFontSize(10)
    doc.setTextColor(0)
    yRechts = addText(doc, `Termin    ${formatDatumDe(auftrag.termin)}`, xRechts, yRechts, 5)
    yRechts = addText(doc, `Lieferung    ${formatLieferung(auftrag.lieferung)}`, xRechts, yRechts, 5)
    yRechts = addText(doc, `Priorität    ${formatPrioritaet(auftrag.prioritaet)}`, xRechts, yRechts, 5)
    yRechts = addText(doc, `Bereich    ${teil.bereich}`, xRechts, yRechts, 5)
    yRechts = addText(doc, `Erstellt    ${formatDatumDe(auftrag.erstellt_am)}`, xRechts, yRechts, 5)

    y = Math.max(yLinks, yRechts) + 8

    doc.setDrawColor(60)
    doc.line(marginL, y, 210 - marginR, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    y = addText(doc, 'Details', marginL, y, 6)
    doc.setFont('helvetica', 'normal')

    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [],
      body: detailZeilen(asDetailRecord(teil.detail)).map(z => [z.label, z.wert]),
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 130 } },
      theme: 'plain',
    })
    y = ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 8

    if (produkte.length > 0 && teil.bereich !== 'TEXTIL') {
      y = checkNewPage(doc, y, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      y = addText(doc, 'Produkte', marginL, y, 6)
      doc.setFont('helvetica', 'normal')

      const detailKeys = produktDetailSchluessel(produkte)
      const header = ['#', 'Typ', ...detailKeys.map(feldZuLabel)]
      const rows = produkte.map((p, idx) => {
        const detail = asDetailRecord(p.detail)
        const typVal = String(p.typ ?? detail.typ ?? '—')
        return [String(idx + 1), typVal, ...detailKeys.map(k => zellenWertFuerSchluessel(p, k))]
      })

      autoTable(doc, {
        startY: y,
        margin: { left: marginL, right: marginR },
        head: [header],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })
      y = ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 8
    }

    if (teil.bereich === 'TEXTIL' && textilPositionen.length > 0) {
      y = checkNewPage(doc, y, 30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      y = addText(doc, 'Positionen', marginL, y, 6)
      doc.setFont('helvetica', 'normal')

      autoTable(doc, {
        startY: y,
        margin: { left: marginL, right: marginR },
        head: [['Produkt', 'Farbe', 'Größe', 'Stückzahl', 'Herkunft', 'Notiz']],
        body: textilPositionen.map(p => {
          const pr = p as Record<string, unknown>
          return [
            String(pr.produkt_name ?? pr.produkt_id ?? '—'),
            String(p.farbe ?? '—'),
            String(p.groesse ?? '—'),
            String(p.stueckzahl ?? '—'),
            String(p.herkunft ?? '—'),
            String(pr.notiz ?? ''),
          ]
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })
      y = ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 8
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Seite ${i} / ${totalPages}`, 210 - marginR, 290, { align: 'right' })
    }

    doc.save(dateiname)
  } catch (e) {
    console.error(e)
  }
}
