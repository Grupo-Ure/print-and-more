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
  return [customer.street, customer.house_number, customer.postal_code, customer.city].some(
    value => value != null && String(value).trim() !== ''
  )
}

function validate(name: string): string | null {
  if (!name.trim()) return 'Name is required'
  return null
}


export function CustomerDialog({ kunde, onSaved, onCancel }: Props) {
  const isEditing = kunde != null
  const [name, setName] = useState(kunde?.name ?? '')
  const [email, setEmail] = useState(kunde?.email ?? '')
  const [telefon, setTelefon] = useState(kunde?.phone ?? '')
  const [notiz, setNotiz] = useState(kunde?.note ?? '')
  const [strasse, setStrasse] = useState(kunde?.street ?? '')
  const [hausnummer, setHausnummer] = useState(kunde?.house_number ?? '')
  const [plz, setPlz] = useState(kunde?.postal_code ?? '')
  const [ort, setOrt] = useState(kunde?.city ?? '')
  const [addressExpanded, setAddressExpanded] = useState(() => hasAddressData(kunde))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(kunde?.name ?? '')
    setEmail(kunde?.email ?? '')
    setTelefon(kunde?.phone ?? '')
    setNotiz(kunde?.note ?? '')
    setStrasse(kunde?.street ?? '')
    setHausnummer(kunde?.house_number ?? '')
    setPlz(kunde?.postal_code ?? '')
    setOrt(kunde?.city ?? '')
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
      phone: telefon.trim() || null,
      note: notiz.trim() || null,
      street: strasse.trim() || null,
      house_number: hausnummer.trim() || null,
      postal_code: plz.trim() || null,
      city: ort.trim() || null,
    }
    try {
      const saved = isEditing
        ? await customerService.updateCustomer(kunde.id, payload)
        : await customerService.createCustomer(payload)
      setSaving(false)
      onSaved(saved as Customer)
    } catch (err) {
      setSaving(false)
      const msg = err instanceof Error ? err.message : 'Error saving'
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
      aria-label={isEditing ? 'Edit Customer' : 'New Customer'}
    >
      <div className="cp-modal" style={{ maxWidth: 420 }}>
        <h3>{isEditing ? 'Edit Customer' : 'New Customer'}</h3>
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
          Email
        </label>
        <input
          type="email"
          className="cp-textarea"
          style={{ marginBottom: 10, minHeight: 0 }}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          Phone
        </label>
        <input
          type="text"
          className="cp-textarea"
          style={{ marginBottom: 10, minHeight: 0 }}
          value={telefon}
          onChange={e => setTelefon(e.target.value)}
        />
        <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
          Note
        </label>
        <textarea className="cp-textarea" rows={3} value={notiz} onChange={e => setNotiz(e.target.value)} />

        <div style={{ marginTop: 12, marginBottom: 6 }}>
          <button
            type="button"
            className="cp-btn cp-btn-grau"
            style={{ width: '100%', textAlign: 'left', fontWeight: 500 }}
            onClick={() => setAddressExpanded(previous => !previous)}
          >
            {addressExpanded ? 'Hide address ▴' : 'Add address ▾'}
          </button>
        </div>
        {addressExpanded && (
          <div style={{ marginBottom: 10 }}>
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              Street
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={strasse}
              onChange={e => setStrasse(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              House No.
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={hausnummer}
              onChange={e => setHausnummer(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              Postal Code
            </label>
            <input
              type="text"
              className="cp-textarea"
              style={{ marginBottom: 8, minHeight: 0 }}
              value={plz}
              onChange={e => setPlz(e.target.value)}
            />
            <label className="cp-hinweis" style={{ display: 'block', marginBottom: 4 }}>
              City
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
            Cancel
          </button>
          <button type="button" className="cp-btn" disabled={saving} onClick={() => void handleSave()}>
            {isEditing ? 'Save changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
