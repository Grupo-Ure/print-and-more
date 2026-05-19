import type { Customer } from '../types/database'

/** Name + (email or phone) required for the auto-prepress rule. */
export function customerMeetsPrepressContact(customer: Customer | null | undefined): boolean {
  if (customer == null) return false
  if (!customer.name?.trim()) return false
  if (customer.email?.trim() || customer.phone?.trim()) return true
  return false
}
