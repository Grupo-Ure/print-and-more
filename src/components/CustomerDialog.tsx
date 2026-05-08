import { useEffect, useState } from 'react'
import { customerService } from '../services/customerService'
import type { Customer } from '../lib/customers'
import './ContextPanel.css'

type Props = {
  kunde?: Customer | null
  onSaved: (k: Customer) => void
  onCancel: () => void
}

function hasAddressData(customer: Customer | null | undefined): boolean {
  if (customer == null) return false
  return [customer.strasse, customer.hausnummer, customer.plz, customer.ort].some(
    value => value != null && String(value).trim() !== ''
  )
}

function validate(name: string): string | null {
  if (!name.trim()) return 'Name ist erforderlich'
  return null
}


export function CustomerDialog({ kunde, onSaved, onCancel }: Props) {
  const isEditing = kunde != null
  const [name, setName] = useState(kunde?.name ?? '')
  const [email, setEmail] = useState(kunde?.email ?? '')
  const [telefon, setTelefon] = useState(kunde?.telefon ?? '')
  const [notiz, setNotiz] = useState(kunde?.notiz ?? '')
  const [strasse, setStrasse] = useState(kunde?.strasse ?? '')
  const [hausnummer, setHausnummer] = useState(kunde?.hausnummer ?? '')
  const [plz, setPlz] = useState(kunde?.plz ?? '')
  const [ort, setOrt] = useState(kunde?.ort ?? '')
  const [addressExpanded, setAddressExpanded] = useState(() => hasAddressData(kunde))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(kunde?.name ?? '')
    setEmail(kunde?.email ?? '')
    setTelefon(kunde?.telefon ?? '')
    setNotiz(kunde?.notiz ?? '')
    setStrasse(kunde?.strasse ?? '')
    setHausnummer(kunde?.hausnummer ?? '')
    setPlz(kunde?.plz ?? '')
    setOrt(kunde?.ort ?? '')
    setAddressExpanded(hasAddressData(kunde))
    setError(null)
  }, [kunde])

  const handleSave = async () => {
    const validationError = validate(name)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSaving(true)
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
    try {
      const saved = isEditing
        ? await customerService.updateCustomer(kunde.id, payload)
        : await customerService.createCustomer(payload)
      setSaving(false)
      onSaved(saved as Customer)
    } catch (err) {
      setSaving(false)
      const msg = err instanceof Error ? err.message : 'Fehler beim Speichern'
      console.error(err)
      setError(msg)
    }
  }

  return (
    <div
      className="cp-modal-bg"
      style={{ zIndex: 110 }}
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Customer bearbeiten' : 'Neuer Customer'}
    >
      <div className="cp-modal" style={{ maxWidth: 420 }}>
        <h3>{isEditing ? 'Customer bearbeiten' : 'Neuer Customer'}</h3>
        {error && (
          <p className="cp-hinweis" style={{ color: '#b91c1c' }}>
            {error}
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
            onClick={() => setAddressExpanded(previous => !previous)}
          >
            {addressExpanded ? 'Adresse ausblenden ▴' : 'Adresse hinzufügen ▾'}
          </button>
        </div>
        {addressExpanded && (
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
          <button type="button" className="cp-btn" onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
          <button type="button" className="cp-btn" disabled={saving} onClick={() => void handleSave()}>
            {isEditing ? 'Änderungen speichern' : 'Customer anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
