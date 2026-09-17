import type { Database } from '../../src/types/supabase'
import type { AdminClient } from './admin'
import type { TestCustomer } from '../fixtures/customers'
import type { TestUser } from '../fixtures/users'

type OrderInsert = Database['public']['Tables']['orders']['Insert']

/** What a spec gets to know about the customer the fixture inserted for it. */
export type TestCustomerRow = TestCustomer & { id: string }

/** What a spec gets to know about the order the fixture created for it. */
export type TestOrder = {
  id: string
  orderNumber: string
  customerId: string
}

/**
 * Seeds and removes test data through the service-role client. Deliberately
 * dumb: raw rows in, raw rows out. It never replays the app's business rules
 * (history entries, status workflows, refusals) — a fixture that needs an
 * order in some state inserts that state; the tests are what drive the app.
 *
 * One instance per worker (the `testData` fixture) and one per runner process
 * (global setup/teardown, where fixtures do not exist).
 */
export class TestData {
  private readonly admin: AdminClient

  constructor(admin: AdminClient) {
    this.admin = admin
  }

  // ── Users ────────────────────────────────────────────────────────────────

  private async findUserId(email: string): Promise<string | null> {
    const { data, error } = await this.admin.from('users').select('id').eq('email', email).maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }

  /**
   * Creates the login unless a previous (crashed) run left it behind. The role
   * goes in via app_metadata: the on_auth_user_role_updated trigger copies it
   * into public.users, so no update from here — which the role-guard trigger
   * would refuse — is needed.
   */
  async ensureUser(user: TestUser): Promise<void> {
    if (await this.findUserId(user.email)) return
    const { error } = await this.admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: { role: user.role },
    })
    if (error) throw error
  }

  /** Deletes the auth user; public.users follows by cascade. */
  async removeUser(user: TestUser): Promise<void> {
    const id = await this.findUserId(user.email)
    if (!id) return
    const { error } = await this.admin.auth.admin.deleteUser(id)
    if (error) throw error
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(customer: TestCustomer): Promise<TestCustomerRow> {
    const { data, error } = await this.admin
      .from('customers')
      .insert({ name: customer.name, email: customer.email })
      .select('id')
      .single()
    if (error) throw error
    return { ...customer, id: data.id }
  }

  /** Deletes the customer with every order it has (see `removeCustomers`). */
  async removeCustomer(customerId: string): Promise<void> {
    await this.removeCustomers([customerId])
  }

  /**
   * Removes every customer saved under this email, with their orders — the one
   * a test just created through the app, or a leftover of an aborted run.
   */
  async removeCustomersByEmail(email: string): Promise<void> {
    const { data, error } = await this.admin.from('customers').select('id').eq('email', email)
    if (error) throw error
    await this.removeCustomers(data.map(row => row.id))
  }

  /**
   * Orders reference their customer without a cascade, so their orders go
   * first (jobs, files and history follow those by cascade), then the customers.
   */
  private async removeCustomers(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error: orderError } = await this.admin.from('orders').delete().in('customer_id', ids)
    if (orderError) throw orderError
    const { error: customerError } = await this.admin.from('customers').delete().in('id', ids)
    if (customerError) throw customerError
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  /**
   * Inserts a quote for an existing customer. `order_number` is assigned by the
   * trg_order_number trigger, so it is left out of the payload (as the app's
   * NewOrderDialog does); `created_by` stays null under the service role.
   */
  async createOrder(customerId: string): Promise<TestOrder> {
    const payload = { customer_id: customerId } as OrderInsert
    const { data, error } = await this.admin.from('orders').insert(payload).select('id, order_number').single()
    if (error) throw error
    return { id: data.id, orderNumber: data.order_number, customerId }
  }

  /** Deletes the order; jobs, files and history follow by cascade. The customer stays. */
  async removeOrder(orderId: string): Promise<void> {
    const { error } = await this.admin.from('orders').delete().eq('id', orderId)
    if (error) throw error
  }
}
