import { useState } from 'react'
import { supabase } from '../supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState('')

  async function einloggen() {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: passwort,
    })
    if (error) setFehler(error.message)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Auftragssystem</h2>
        <input
          placeholder="E-Mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <input
          placeholder="Passwort"
          type="password"
          value={passwort}
          onChange={e => setPasswort(e.target.value)}
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        {fehler && <p style={{ color: 'red', fontSize: 13 }}>{fehler}</p>}
        <button onClick={einloggen} style={{ padding: 8, background: '#18181b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Einloggen
        </button>
      </div>
    </div>
  )
}