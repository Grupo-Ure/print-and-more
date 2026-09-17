import type { Database } from '../../src/types/supabase'
import type { AdminClient } from './admin'

type OrderInsert = Database['public']['Tables']['orders']['Insert']

/** What a spec gets to know about the order the fixture created for it. */
export type TestOrder = {
  id: string
  orderNumber: string
  customerId: string
}

/**
 * Inserts a quote for an existing customer. `order_number` is assigned by the
 * trg_order_number trigger, so it is left out of the payload (as the app's
 * NewOrderDialog does); `created_by` stays null under the service role.
 */
export async function createTestOrder(admin: AdminClient, customerId: string): Promise<TestOrder> {
  const payload = { customer_id: customerId } as OrderInsert
  const { data, error } = await admin.from('orders').insert(payload).select('id, order_number').single()
  if (error) throw error
  return { id: data.id, orderNumber: data.order_number, customerId }
}

/** Deletes the order; jobs, files and history follow by cascade. The customer stays. */
export async function removeTestOrder(admin: AdminClient, orderId: string): Promise<void> {
  const { error } = await admin.from('orders').delete().eq('id', orderId)
  if (error) throw error
}
