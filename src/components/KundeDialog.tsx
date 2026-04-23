import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Kunde } from '../lib/kunden'
import './ContextPanel.css'

type Props = {
  kunde?: Kunde | null
  onGespeichert: (k: Kunde) => void
  onAbbrechen: () => void
}

function validiere(name: string, email: string, telefon: string): string | null {
  const n = name.trim()
  if (!n) return 'Name und mind. E-Mail oder Telefon sind erforderlich'
  if (!email.trim() && !telefon.trim()) return 'Name und mind. E-Mail oder Telefon sind erforderlich'
  return null
}

export function KundeDialog({ kunde, onGespeichert, onAbbrechen }: Props) {
  const istBearbeiten = kunde != null
  const [name, setName] = useState(kunde?.name ?? '')
  const [email, setEmail] = useState(kunde?.email ?? '')
  const [telefon, setTelefon] = useState(kunde?.telefon ?? '')
  const [notiz, setNotiz] = useState(kunde?.notiz ?? '')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    setName(kunde?.name ?? '')
    setEmail(kunde?.email ?? '')
    setTelefon(kunde?.telefon ?? '')
    setNotiz(kunde?.notiz ?? '')
    setFehler(null)
  }, [kunde])

  const speichern = async () => {
    const v = validiere(name, email, telefon)
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
    }
    if (istBearbeiten) {
      const { data, error } = await supabase
        .from('kunden')
        .update(payload)
        .eq('id', kunde.id)
        .select('id, name, email, telefon, notiz')
        .single()
      setSpeichert(false)
      if (error) {
        console.error(error)
        setFehler(error.message)
        return
      }
      if (data) onGespeichert(data as Kunde)
    } else {
      const { data, error } = await supabase.from('kunden').insert(payload).select('id, name, email, telefon, notiz').single()
      setSpeichert(false)
      if (error) {
        console.error(error)
        setFehler(error.message)
        return
      }
      if (data) onGespeichert(data as Kunde)
    }
  }

  return (
    <div
      className="cp-modal-bg"
      style={{ zIndex: 110 }}
      role="dialog"
      aria-modal="true"
      aria-label={istBearbeiten ? 'Kunde bearbeiten' : 'Neuer Kunde'}
    >
      <div className="cp-modal" style={{ maxWidth: 420 }}>
        <h3>{istBearbeiten ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h3>
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
        <div className="cp-modal-bar">
          <button type="button" className="cp-btn" onClick={onAbbrechen} disabled={speichert}>
            Abbrechen
          </button>
          <button type="button" className="cp-btn" disabled={speichert} onClick={() => void speichern()}>
            {istBearbeiten ? 'Änderungen speichern' : 'Kunde anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}
