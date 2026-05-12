import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  note: string | null
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
}

const CUSTOMER_COLUMNS = 'id, name, email, phone, note, street, house_number, postal_code, city'

class CustomerService {
  async searchCustomers(query: string): Promise<CustomerRow[]> {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .ilike('name', `%${query}%`)
      .eq('is_archived', false)
      .order('name')
      .limit(20)
    if (error) throw error
    return (data ?? []) as CustomerRow[]
  }

  async getCustomerById(id: string): Promise<CustomerRow | null> {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as CustomerRow | null
  }

  async createCustomer(payload: CustomerInsert): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .insert(payload)
      .select(CUSTOMER_COLUMNS)
      .single()
    if (error) throw error
    return data as CustomerRow
  }

  async updateCustomer(id: string, payload: CustomerUpdate): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select(CUSTOMER_COLUMNS)
      .single()
    if (error) throw error
    return data as CustomerRow
  }

  /** Returns IDs of all customers (including archived) whose name matches the query. Used for order list search. */
  async searchCustomerIds(query: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${query}%`)
    if (error) throw error
    return (data ?? []).map(r => r.id)
  }
}

export const customerService = new CustomerService()
