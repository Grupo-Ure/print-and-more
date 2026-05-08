import { supabase } from '../supabase'
import type { Database } from '../types/supabase'

type CustomerInsert = Database['public']['Tables']['kunden']['Insert']
type CustomerUpdate = Database['public']['Tables']['kunden']['Update']

export type CustomerRow = {
  id: string
  name: string
  email: string | null
  telefon: string | null
  notiz: string | null
  strasse: string | null
  hausnummer: string | null
  plz: string | null
  ort: string | null
}

const CUSTOMER_COLUMNS = 'id, name, email, telefon, notiz, strasse, hausnummer, plz, ort'

class CustomerService {
  async searchCustomers(query: string): Promise<CustomerRow[]> {
    const { data, error } = await supabase
      .from('kunden')
      .select(CUSTOMER_COLUMNS)
      .ilike('name', `%${query}%`)
      .eq('archiviert', false)
      .order('name')
      .limit(20)
    if (error) throw error
    return (data ?? []) as CustomerRow[]
  }

  async getCustomerById(id: string): Promise<CustomerRow | null> {
    const { data, error } = await supabase
      .from('kunden')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as CustomerRow | null
  }

  async createCustomer(payload: CustomerInsert): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('kunden')
      .insert(payload)
      .select(CUSTOMER_COLUMNS)
      .single()
    if (error) throw error
    return data as CustomerRow
  }

  async updateCustomer(id: string, payload: CustomerUpdate): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('kunden')
      .update(payload)
      .eq('id', id)
      .select(CUSTOMER_COLUMNS)
      .single()
    if (error) throw error
    return data as CustomerRow
  }
}

export const customerService = new CustomerService()
