import type { Database } from '../../src/types/supabase'
import type { AdminClient } from './admin'
import type { TestCustomer } from '../fixtures/customers'

type OrderInsert = Database['public']['Tables']['orders']['Insert']

/** What a spec gets to know about the order the fixture created for it. */
export type TestOrder = {
  id: string
  orderNumber: string
  customerId: string
}

/**
 * Inserts a customer and a quote for it. `order_number` is assigned by the
 * trg_order_number trigger, so it is left out of the payload (as the app's
 * NewOrderDialog does); `created_by` stays null under the service role.
 */
export async function createTestOrder(admin: AdminClient, customer: TestCustomer): Promise<TestOrder> {
  const { data: customerRow, error: customerError } = await admin
    .from('customers')
    .insert({ name: customer.name, email: customer.email })
    .select('id')
    .single()
  if (customerError) throw customerError

  const payload = { customer_id: customerRow.id } as OrderInsert
  const { data: orderRow, error: orderError } = await admin
    .from('orders')
    .insert(payload)
    .select('id, order_number')
    .single()
  if (orderError) throw orderError

  return { id: orderRow.id, orderNumber: orderRow.order_number, customerId: customerRow.id }
}

/** Deletes the order (jobs, files and history follow by cascade), then its customer. */
export async function removeTestOrder(admin: AdminClient, order: TestOrder): Promise<void> {
  const { error: orderError } = await admin.from('orders').delete().eq('id', order.id)
  if (orderError) throw orderError
  const { error: customerError } = await admin.from('customers').delete().eq('id', order.customerId)
  if (customerError) throw customerError
}
