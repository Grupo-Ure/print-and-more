import type { Customer } from '../types/database'

/**
 * One-line postal address, "<street> <house number>, <postal code> <city>",
 * built from whichever parts are set; empty when the customer has none.
 */
export function formatCustomerAddress(customer: Customer | null | undefined): string {
  if (customer == null) return ''
  const streetLine = [customer.street, customer.house_number]
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  const cityLine = [customer.postal_code, customer.city]
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  return [streetLine, cityLine].filter(Boolean).join(', ')
}
