import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import type { AuftragListRow } from '../types/database'

type Props = {
  aktiverAuftragId: string | null
  onAuftragWaehlen: (id: string) => void
}

export function OrderList({ aktiverAuftragId, onAuftragWaehlen }: Props) {
  const [auftraege, setAuftraege] = useState<AuftragListRow[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase
      .from('auftraege')
      .select('id, auftragsnummer, status, erstellt_am, kunden(name)')
      .order('erstellt_am', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setAuftraege(data ?? [])
        setLaden(false)
      })
  }, [])

  if (laden) return <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Lädt...</div>

  if (auftraege.length === 0) {
    return (
      <div style={{ padding: 16, color: '#888', fontSize: 13 }}>
        Noch keine Aufträge
      </div>
    )
  }

  return (
    <div>
      {auftraege.map(a => {
        const aktiv = a.id === aktiverAuftragId
        return (
          <div
            key={a.id}
            onClick={() => onAuftragWaehlen(a.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onAuftragWaehlen(a.id)
              }
            }}
            role="button"
            tabIndex={0}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e5e5',
              cursor: 'pointer',
              background: aktiv ? '#111' : 'transparent',
              color: aktiv ? '#fff' : 'inherit',
            }}
          >
            <div style={{ fontWeight: 500 }}>{kundenName(a.kunden)}</div>
            <div
              style={{
                fontSize: 12,
                color: aktiv ? 'rgba(255,255,255,0.75)' : '#888',
                marginTop: 2,
              }}
            >
              {a.auftragsnummer} · {a.status}
            </div>
          </div>
        )
      })}
    </div>
  )
}
