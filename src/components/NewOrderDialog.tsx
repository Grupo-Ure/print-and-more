import { useCallback, useEffect, useState } from 'react'
import { historyService } from '../services/historyService'
import { customerService } from '../services/customerService'
import { orderService } from '../services/orderService'
import type { DeliveryChoice, OrderStatus, Priority } from '../types/database'
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
  const { showError } = useToast()
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
    try {
      const data = await customerService.searchCustomers(trimmedQuery)
      setSearchResults(data as Customer[])
    } catch {
      showError('Customer search failed')
      setSearchResults([])
    }
    setSearchLoading(false)
  }, [showError])

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
    try {
      const data = await customerService.getCustomerById(selectedCustomer.id)
      setEditingCustomer(false)
      if (data) {
        setCustomerForForm(data as Customer)
        setCustomerSubDialog('bearbeiten')
      }
    } catch {
      setEditingCustomer(false)
      showError('Customer could not be loaded')
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
    const auftragInsert = {
      customer_id: selectedCustomer.id,
      status: 'QUOTE',
      deadline: null,
      delivery: 'PICKUP',
      priority: 'NORMAL',
    }
    let data: NewOrderInsertRow
    try {
      data = await orderService.createOrder(auftragInsert as Parameters<typeof orderService.createOrder>[0]) as unknown as NewOrderInsertRow
    } catch (err) {
      setCreating(false)
      setError(err instanceof Error ? err.message : 'Error creating order')
      return
    }
    setCreating(false)
    onSuccess(data)
    try {
      await historyService.writeHistory({
        order_id: data.id,
        event_type: 'ORDER_CREATED',
      })
    } catch {
      console.error('History ORDER_CREATED failed')
      showError('Order created, but history entry failed')
    }
  }

  if (!open) return null

  return (
    <>
      <div className="cp-modal-bg" role="dialog" aria-modal="true" aria-label="New Order">
        <div className="cp-modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
          <h3>New Order</h3>
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
                placeholder="Search customer…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchLoading && <p className="cp-hinweis">Searching…</p>}
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
                    No results
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
                      {customer.email || customer.phone || '—'}
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" className="cp-btn" onClick={() => { setCustomerForForm(null); setCustomerSubDialog('neu') }}>
                + New Customer
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
                    {selectedCustomer.email || selectedCustomer.phone || '—'}
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
                    {editingCustomer ? '…' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ width: 'auto' }}
                    onClick={() => setSelectedCustomer(null)}
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="cp-modal-bar" style={{ marginTop: 16 }}>
            <button type="button" className="cp-btn" onClick={onClose} disabled={creating}>
              Cancel
            </button>
            <button
              type="button"
              className="cp-btn"
              disabled={!selectedCustomer || creating}
              onClick={() => void handleCreateOrder()}
            >
              Create Order
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
