import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Customer } from '../lib/customers'
import './ContextPanel.css'

type Props = {
  kunde?: Customer | null
  onSaved: (k: Customer) => void
  onCancel: () => void
}

function hatAdressdaten(k: Customer | null | undefined): boolean {
  if (k == null) return false
  return [k.strasse, k.hausnummer, k.plz, k.ort].some(s => s != null && String(s).trim() !== '')
}

function validiere(name: string): string | null {
  if (!name.trim()) return 'Name ist erforderlich'
  return null
}

const KUNDEN_SPALTEN =
  'id, name, email, telefon, notiz, strasse, hausnummer, plz, ort' as const

export function CustomerDialog({ kunde, onSaved, onCancel }: Props) {
  const istBearbeiten = kunde != null
  const [name, setName] = useState(kunde?.name ?? '')
  const [email, setEmail] = useState(kunde?.email ?? '')
  const [telefon, setTelefon] = useState(kunde?.telefon ?? '')
  const [notiz, setNotiz] = useState(kunde?.notiz ?? '')
  const [strasse, setStrasse] = useState(kunde?.strasse ?? '')
  const [hausnummer, setHausnummer] = useState(kunde?.hausnummer ?? '')
  const [plz, setPlz] = useState(kunde?.plz ?? '')
  const [ort, setOrt] = useState(kunde?.ort ?? '')
  const [adresseAufgeklappt, setAdresseAufgeklappt] = useState(() => hatAdressdaten(kunde))
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    setName(kunde?.name ?? '')
    setEmail(kunde?.email ?? '')
    setTelefon(kunde?.telefon ?? '')
    setNotiz(kunde?.notiz ?? '')
    setStrasse(kunde?.strasse ?? '')
    setHausnummer(kunde?.hausnummer ?? '')
    setPlz(kunde?.plz ?? '')
    setOrt(kunde?.ort ?? '')
    setAdresseAufgeklappt(hatAdressdaten(kunde))
    setFehler(null)
  }, [kunde])

  const speichern = async () => {
    const v = validiere(name)
    if (v) {
      setFehler(v)
      return
    }
    setFehler(null)
    setSpeichert(true)
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      telefon: telefon.trim() || null,
      notiz: notiz.trim() || null,
      strasse: strasse.trim() || null,
      hausnummer: hausnummer.trim() || null,
      plz: plz.trim() || null,
      ort: ort.trim() || null,
    }
    if (istBearbeiten) {
      const { data, error } = await supabase
        .from('kunden')
        .update(payload)
        .eq('id', kunde.id)
        .select(KUNDEN_SPALTEN)
        .single()
      setSpeichert(false)
      if (error) {
        console.error(error)
        setFehler(error.message)
        return
      }
      if (data) onSaved(data as Customer)
    } else {
      const { data, error } = await supabase
        .from('kunden')
        .insert(payload)
        .select(KUNDEN_SPALTEN)
        .single()
      setSpeichert(false)
      if (error) {
        console.error(error)
        setFehler(error.message)
        return
      }
      if (data) onSaved(data as Customer)
    }
  }

  return (
    <div
      className="cp-modal-bg"
      style={{ zIndex: 110 }}
      role="dialog"
      aria-modal="true"
      aria-label={istBearbeiten ? 'Customer bearbeiten' : 'Neuer Customer'}
    >
      <div className="cp-modal" style={{ maxWidth: 420 }}>
        <h3>{istBearbeiten ? 'Customer bearbeiten' : 'Neuer Customer'}</h3>
        {fehler && (
          <p className="cp-hinweis" style={{ color: '#b91c1c' }}>
            {fehler}
          </p>
        )}
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          Name *
        </label>
        <input
          type="text"
          className="cp-textarea"
          style={{ marginBottom: 10, minHeight: 0, height: 'auto' }}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          E-Mail
        </label>
        <input
          type="email"
          className="cp-textarea"
          style={{ marginBottom: 10, minHeight: 0 }}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          Telefon
        </label>
        <input
          type="text"
          className="cp-textarea"
          style={{ marginBottom: 10, minHeight: 0 }}
          value={telefon}
          onChange={e => setTelefon(e.target.value)}
        />
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          Notiz
        </label>
        <textarea className="cp-textarea" rows={3} value={notiz} onChange={e => setNotiz(e.target.value)} />

        <div style={{ marginTop: 12, marginBottom: 6 }}>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            style={{ width: '100%', textAlign: 'left', fontWeight: 500 }}
            onClick={() => setAdresseAufgeklappt(o => !o)}
          >
            {adresseAufgeklappt ? 'Adresse ausblenden ▴' : 'Adresse hinzufügen ▾'}
          </button>
        </div>
        {adresseAufgeklappt && (
          <div style={{ marginBottom: 10 }}>
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              Straße
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={strasse}
              onChange={e => setStrasse(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              Hausnummer
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={hausnummer}
              onChange={e => setHausnummer(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              PLZ
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={plz}
              onChange={e => setPlz(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              Ort
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 0, minHeight: 0 }}
              value={ort}
              onChange={e => setOrt(e.target.value)}
            />
          </div>
        )}

        <div className="cp-modal-bar" style={{ marginTop: 14 }}>
          <button type="button" className="cp-btn" onClick={onCancel} disabled={speichert}>
            Abbrechen
          </button>
          <button type="button" className="cp-btn" disabled={speichert} onClick={() => void speichern()}>
            {istBearbeiten ? 'Änderungen speichern' : 'Customer anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
