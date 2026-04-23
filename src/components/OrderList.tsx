import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { kundenName } from '../lib/kunde'
import type { AuftragListRow } from '../types/database'

type Props = {
  aktiverAuftragId: string | null
  onAuftragWaehlen: (id: string) => void
  onNeuerAuftrag: () => void
}

export function OrderList({ aktiverAuftragId, onAuftragWaehlen, onNeuerAuftrag }: Props) {
  const [auftraege, setAuftraege] = useState<AuftragListRow[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase
      .from('auftraege')
      .select('id, auftragsnummer, status, erstellt_am, kunden(name)')
      .eq('archiviert', false)
      .order('erstellt_am', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setAuftraege(data ?? [])
        setLaden(false)
      })
  }, [])

  return (
    <div>
      <div
        style={{
          padding: 12,
          borderBottom: '1px solid #e5e5e5',
          position: 'sticky',
          top: 0,
          background: '#fafafa',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onNeuerAuftrag}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + Neuer Auftrag
        </button>
      </div>
      {laden && <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Lädt...</div>}
      {!laden && auftraege.length === 0 && (
        <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Noch keine Aufträge</div>
      )}
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

