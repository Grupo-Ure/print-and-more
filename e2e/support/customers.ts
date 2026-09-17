import type { AdminClient } from './admin'
import type { TestCustomer } from '../fixtures/customers'

/** What a spec gets to know about the customer the fixture inserted for it. */
export type TestCustomerRow = TestCustomer & { id: string }

export async function createTestCustomer(admin: AdminClient, customer: TestCustomer): Promise<TestCustomerRow> {
  const { data, error } = await admin
    .from('customers')
    .insert({ name: customer.name, email: customer.email })
    .select('id')
    .single()
  if (error) throw error
  return { ...customer, id: data.id }
}

/**
 * Deletes these customers' orders (jobs, files and history follow by
 * cascade), then the customers — orders reference their customer without a
 * cascade, so the order has to go first.
 */
async function removeCustomers(admin: AdminClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error: orderError } = await admin.from('orders').delete().in('customer_id', ids)
  if (orderError) throw orderError
  const { error: customerError } = await admin.from('customers').delete().in('id', ids)
  if (customerError) throw customerError
}

export async function removeTestCustomer(admin: AdminClient, customerId: string): Promise<void> {
  await removeCustomers(admin, [customerId])
}

/**
 * Removes every customer saved under this email, with their orders — the one
 * a test just created through the app, or a leftover of an aborted run.
 */
export async function removeTestCustomersByEmail(admin: AdminClient, email: string): Promise<void> {
  const { data, error } = await admin.from('customers').select('id').eq('email', email)
  if (error) throw error
  await removeCustomers(admin, data.map(row => row.id))
}
