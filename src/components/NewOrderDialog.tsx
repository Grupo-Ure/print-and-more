import { useCallback, useEffect, useState } from 'react'
import { writeHistory } from '../lib/history'
import { supabase } from '../supabase'
import type { DeliveryChoice, OrderStatus, Priority } from '../types/database'
import type { Database } from '../types/supabase'
import type { Customer } from '../lib/customers'
import { CustomerDialog } from './CustomerDialog'
import { useToast } from './Toast'
import './ContextPanel.css'
import './WorkArea.css'

export type NewOrderInsertRow = {
  id: string
  auftragsnummer: string
  status: OrderStatus
  erstellt_am: string
  kunde_id: string
  termin: string | null
  lieferung: DeliveryChoice | null
  prioritaet: Priority
  notfall_aktiv: boolean
  archiviert: boolean
  erp_exportiert: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (a: NewOrderInsertRow) => void
}

export function NewOrderDialog({ open, onClose, onSuccess }: Props) {
  const { fehler: toastFehler } = useToast()
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerSubDialog, setCustomerSubDialog] = useState<'neu' | 'bearbeiten' | null>(null)
  const [customerForForm, setCustomerForForm] = useState<Customer | null>(null)
  const [editingCustomer, setEditingCustomer] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset on open
    setSelectedCustomer(null)
    setSearchQuery('')
    setSearchResults([])
    setError(null)
    setCustomerSubDialog(null)
    setCustomerForForm(null)
  }, [open])

  const runSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const { data, error: searchError } = await supabase
      .from('kunden')
      .select('id, name, email, telefon, notiz, strasse, hausnummer, plz, ort')
      .ilike('name', `%${trimmedQuery}%`)
      .eq('archiviert', false)
      .order('name')
      .limit(20)
    setSearchLoading(false)
    if (searchError) {
      toastFehler('Customernsuche fehlgeschlagen')
      setSearchResults([])
      return
    }
    setSearchResults((data ?? []) as Customer[])
  }, [toastFehler])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      void runSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, runSearch, open])

  const openEditCustomer = async () => {
    if (!selectedCustomer) return
    setEditingCustomer(true)
    const { data, error: loadError } = await supabase
      .from('kunden')
      .select('id, name, email, telefon, notiz, strasse, hausnummer, plz, ort')
      .eq('id', selectedCustomer.id)
      .single()
    setEditingCustomer(false)
    if (loadError) {
      toastFehler('Customer konnte nicht geladen werden')
      return
    }
    if (data) {
      setCustomerForForm(data as Customer)
      setCustomerSubDialog('bearbeiten')
    }
  }

  const handleCustomerSaved = (customer: Customer) => {
    setCustomerSubDialog(null)
    setCustomerForForm(null)
    setSelectedCustomer(customer)
  }

  const handleCreateOrder = async () => {
    if (!selectedCustomer) return
    setError(null)
    setCreating(true)
    const auftragInsert: Database['public']['Tables']['auftraege']['Insert'] = {
      kunde_id: selectedCustomer.id,
      status: 'ANGEBOT',
      termin: null,
      lieferung: 'ABHOLUNG',
      prioritaet: 'NORMAL',
    }
    const { data, error: insertError } = await supabase.from('auftraege').insert(auftragInsert)
      .select(
        'id, auftragsnummer, status, erstellt_am, kunde_id, termin, lieferung, prioritaet, notfall_aktiv, archiviert, erp_exportiert'
      )
      .single()
    setCreating(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    if (data) {
      onSuccess(data as NewOrderInsertRow)
      try {
        await writeHistory({
          auftrag_id: (data as NewOrderInsertRow).id,
          ereignisart: 'AUFTRAG_ERSTELLT',
        })
      } catch {
        console.error('Historie AUFTRAG_ERSTELLT fehlgeschlagen')
        toastFehler('Auftrag angelegt, aber Verlaufseintrag fehlgeschlagen')
      }
    }
  }

  if (!open) return null

  return (
    <>
      <div className="cp-modal-bg" role="dialog" aria-modal="true" aria-label="Neuer Auftrag">
        <div className="cp-modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
          <h3>Neuer Auftrag</h3>
          {error && (
            <p className="cp-hinweis" style={{ color: '#b91c1c' }}>
              {error}
            </p>
          )}

          <h4 className="ber-h3" style={{ marginTop: 0, fontSize: '0.8rem' }}>
            Customer
          </h4>
          {selectedCustomer == null && (
            <>
              <input
                type="search"
                className="ber-inp"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
                placeholder="Customernsuche …"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchLoading && <p className="cp-hinweis">Suche…</p>}
              <div
                style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginBottom: 8,
                }}
              >
                {searchResults.length === 0 && !searchLoading && searchQuery.trim() && (
                  <p className="cp-hinweis" style={{ padding: 8, margin: 0 }}>
                    Keine Treffer
                  </p>
                )}
                {searchResults.map(customer => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setSelectedCustomer(customer)}
                    className="cp-btn"
                    style={{
                      border: 'none',
                      borderRadius: 0,
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <strong>{customer.name}</strong>
                    <div className="cp-hinweis" style={{ margin: '4px 0 0' }}>
                      {customer.email || customer.telefon || '—'}
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" className="cp-btn" onClick={() => { setCustomerForForm(null); setCustomerSubDialog('neu') }}>
                + Neuer Customer
              </button>
            </>
          )}

          {selectedCustomer && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: '#f5f5f5',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                  <div className="cp-hinweis" style={{ marginTop: 4 }}>
                    {selectedCustomer.email || selectedCustomer.telefon || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ width: 'auto' }}
                    disabled={editingCustomer}
                    onClick={() => { void openEditCustomer() }}
                  >
                    {editingCustomer ? '…' : 'Ändern'}
                  </button>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ width: 'auto' }}
                    onClick={() => setSelectedCustomer(null)}
                  >
                    Andere wählen
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="cp-modal-bar" style={{ marginTop: 16 }}>
            <button type="button" className="cp-btn" onClick={onClose} disabled={creating}>
              Abbrechen
            </button>
            <button
              type="button"
              className="cp-btn"
              disabled={!selectedCustomer || creating}
              onClick={() => void handleCreateOrder()}
            >
              Auftrag anlegen
            </button>
          </div>
        </div>
      </div>

      {customerSubDialog === 'neu' && (
        <CustomerDialog kunde={null} onSaved={handleCustomerSaved} onCancel={() => setCustomerSubDialog(null)} />
      )}
      {customerSubDialog === 'bearbeiten' && customerForForm && (
        <CustomerDialog
          kunde={customerForForm}
          onSaved={handleCustomerSaved}
          onCancel={() => {
            setCustomerSubDialog(null)
            setCustomerForForm(null)
          }}
        />
      )}
    </>
  )
}
