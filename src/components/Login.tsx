import { useState } from 'react'
import { authService } from '../services/authService'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  async function handleLogin() {
    try {
      await authService.signIn(email.trim(), password)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen')
    }
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
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        {loginError && <p style={{ color: 'red', fontSize: 13 }}>{loginError}</p>}
        <button onClick={handleLogin} style={{ padding: 8, background: '#18181b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Einloggen
        </button>
      </div>
    </div>
  )
}