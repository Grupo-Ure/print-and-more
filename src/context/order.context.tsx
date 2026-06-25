import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { CustomerDialog } from '../components/CustomerDialog'
import type { Customer } from '../types/database'

type OpenCustomerDialogOptions = {
  onSaved?: (saved: Customer) => void
}

type OrderWorkspaceValue = {
  openCustomerDialog: (customer: Customer | null, options?: OpenCustomerDialogOptions) => void
  closeCustomerDialog: () => void
}

const OrderWorkspaceContext = createContext<OrderWorkspaceValue | null>(null)

type CustomerDialogState = {
  open: boolean
  customer: Customer | null
  onSaved: ((saved: Customer) => void) | undefined
}

const INITIAL_DIALOG_STATE: CustomerDialogState = { open: false, customer: null, onSaved: undefined }

export function OrderWorkspaceProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<CustomerDialogState>(INITIAL_DIALOG_STATE)

  const openCustomerDialog = useCallback(
    (customer: Customer | null, options?: OpenCustomerDialogOptions) => {
      setDialog({ open: true, customer, onSaved: options?.onSaved })
    },
    [],
  )

  const closeCustomerDialog = useCallback(() => {
    setDialog(INITIAL_DIALOG_STATE)
  }, [])

  const value = useMemo<OrderWorkspaceValue>(
    () => ({ openCustomerDialog, closeCustomerDialog }),
    [openCustomerDialog, closeCustomerDialog],
  )

  return (
    <OrderWorkspaceContext.Provider value={value}>
      {children}
      <CustomerDialog
        open={dialog.open}
        onOpenChange={open => {
          if (!open) setDialog(INITIAL_DIALOG_STATE)
        }}
        customer={dialog.customer}
        onSaved={saved => {
          dialog.onSaved?.(saved)
        }}
      />
    </OrderWorkspaceContext.Provider>
  )
}

export function useOrderWorkspace(): OrderWorkspaceValue {
  const value = useContext(OrderWorkspaceContext)
  if (value == null) {
    throw new Error('useOrderWorkspace must be used within an OrderWorkspaceProvider')
  }
  return value
}
