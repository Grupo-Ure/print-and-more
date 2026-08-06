import { useState } from 'react'

export type BookingItem = { id: string; stock: number | null }

export type StockBooking = {
  quantityFor: (itemId: string) => string
  setQuantity: (itemId: string, rawValue: string) => void
  errorFor: (itemId: string) => string | null
  busyId: string | null
  /** Validated quantity for an item, or null while the input is invalid. */
  parsedQuantity: (itemId: string) => number | null
  book: (item: BookingItem, type: 'INBOUND' | 'OUTBOUND') => Promise<void>
}

/**
 * Per-row booking state (quantity input, validation, busy flag, error) shared
 * by the stamp and textile stock tables. `performBooking` does the actual
 * writes; on success the input is cleared.
 */
export function useStockBooking(
  performBooking: (args: {
    itemId: string
    quantity: number
    nextStock: number
    type: 'INBOUND' | 'OUTBOUND'
  }) => Promise<void>,
): StockBooking {
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const quantityFor = (itemId: string): string => (quantities[itemId] ?? '').slice(0, 3)

  const parsedQuantity = (itemId: string): number | null => {
    const raw = quantityFor(itemId).trim()
    if (raw === '') return null
    const quantity = parseInt(raw, 10)
    return Number.isInteger(quantity) && quantity >= 1 ? quantity : null
  }

  const setQuantity = (itemId: string, rawValue: string): void => {
    const cleaned = rawValue.replace(/[^\d]/g, '').slice(0, 3)
    setQuantities(previous => ({ ...previous, [itemId]: cleaned }))
  }

  const book = async (item: BookingItem, type: 'INBOUND' | 'OUTBOUND'): Promise<void> => {
    if (busyId) return
    setErrors(previous => ({ ...previous, [item.id]: null }))
    const quantity = parsedQuantity(item.id)
    if (quantity == null) {
      setErrors(previous => ({ ...previous, [item.id]: 'Quantity: integer ≥ 1' }))
      return
    }
    const stockDelta = type === 'INBOUND' ? quantity : -quantity
    const nextStock = (item.stock ?? 0) + stockDelta
    if (nextStock < 0) {
      setErrors(previous => ({ ...previous, [item.id]: 'Quantity exceeds current stock' }))
      return
    }
    setBusyId(item.id)
    try {
      await performBooking({ itemId: item.id, quantity, nextStock, type })
      setQuantities(previous => ({ ...previous, [item.id]: '' }))
    } catch (error) {
      setErrors(previous => ({
        ...previous,
        [item.id]: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setBusyId(null)
    }
  }

  return {
    quantityFor,
    setQuantity,
    errorFor: itemId => errors[itemId] ?? null,
    busyId,
    parsedQuantity,
    book,
  }
}
