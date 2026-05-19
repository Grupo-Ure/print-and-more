import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CustomerDialog } from '../components/CustomerDialog'
import type { Customer } from '../lib/customers'

const ORDER_PARAM = 'order'
const SUB_ORDER_PARAM = 'sub'

type OpenCustomerDialogOptions = {
  onSaved?: (saved: Customer) => void
}

type OrderWorkspaceValue = {
  activeOrderId: string | null
  activeSubOrderId: string | null
  setActiveOrder: (orderId: string | null) => void
  setActiveSubOrder: (subOrderId: string | null) => void
  clearActive: () => void
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [dialog, setDialog] = useState<CustomerDialogState>(INITIAL_DIALOG_STATE)

  const activeOrderId = searchParams.get(ORDER_PARAM) || null
  const activeSubOrderId = searchParams.get(SUB_ORDER_PARAM) || null

  const setActiveOrder = useCallback(
    (orderId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          const current = next.get(ORDER_PARAM)
          if (orderId == null) {
            next.delete(ORDER_PARAM)
            next.delete(SUB_ORDER_PARAM)
          } else {
            next.set(ORDER_PARAM, orderId)
            // Switching to a different order: drop the stale sub-order selection.
            if (current !== orderId) next.delete(SUB_ORDER_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setActiveSubOrder = useCallback(
    (subOrderId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          if (subOrderId == null) next.delete(SUB_ORDER_PARAM)
          else next.set(SUB_ORDER_PARAM, subOrderId)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearActive = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete(ORDER_PARAM)
        next.delete(SUB_ORDER_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

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
    () => ({
      activeOrderId,
      activeSubOrderId,
      setActiveOrder,
      setActiveSubOrder,
      clearActive,
      openCustomerDialog,
      closeCustomerDialog,
    }),
    [
      activeOrderId,
      activeSubOrderId,
      setActiveOrder,
      setActiveSubOrder,
      clearActive,
      openCustomerDialog,
      closeCustomerDialog,
    ],
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
