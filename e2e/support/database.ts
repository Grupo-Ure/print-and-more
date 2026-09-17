import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '../../src/types/supabase'
import type { ChildTable } from '../../src/types/product'
import type { TestCustomer } from '../fixtures/customers'
import type { TestUser } from '../fixtures/users'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type JobInsert = Database['public']['Tables']['jobs']['Insert']
type Department = Database['public']['Enums']['department']
type OrderStatus = Database['public']['Enums']['order_status']
type DeliveryType = Database['public']['Enums']['delivery_type']

/** The columns a fixture chooses for an order it inserts; everything else takes the table's defaults. */
export type OrderSeedRow = {
  status: OrderStatus
  deadline: string | null
  delivery: DeliveryType | null
}

/**
 * A product to insert for a job: the parent's `type` plus the typed child row
 * that type maps to. Distributed over the child tables so `child` is typed by
 * the `childTable` chosen.
 */
export type ProductSeed = {
  [T in ChildTable]: {
    type: string
    childTable: T
    child: Omit<TablesInsert<T>, 'department_product_id'>
  }
}[ChildTable]

/** What a spec gets to know about the customer the fixture inserted for it. */
export type TestCustomerRow = TestCustomer & { id: string }

/** What a spec gets to know about the order the fixture created for it. */
export type TestOrder = {
  id: string
  orderNumber: string
  customerId: string
}

/** What a spec gets to know about the job the fixture created for it. */
export type TestJob = {
  id: string
  jobNumber: string
  orderId: string
  department: Department
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. The e2e runner needs it to provision test data — ` +
        'for a local Supabase, copy it from `supabase status`.',
    )
  }
  return value
}

/**
 * The test runner's own connection to the database: a service-role Supabase
 * client (bypasses RLS, exposes `auth.admin`) with the seeding methods every
 * fixture uses. Never used from inside the app under test.
 *
 * Deliberately dumb: raw rows in, raw rows out. It never replays the app's
 * business rules (history entries, status workflows, refusals) — a fixture
 * that needs an order in some state inserts that state; the tests are what
 * drive the app.
 *
 * One instance per worker (the `database` fixture) and one per runner process
 * (global setup/teardown, where fixtures do not exist).
 */
export class TestDatabase {
  private readonly client: SupabaseClient<Database>

  constructor() {
    this.client = createClient<Database>(
      requiredEnv('VITE_SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }

  // ── Users ────────────────────────────────────────────────────────────────

  private async findUserId(email: string): Promise<string | null> {
    const { data, error } = await this.client.from('users').select('id').eq('email', email).maybeSingle()
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
    const { error } = await this.client.auth.admin.createUser({
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
    const { error } = await this.client.auth.admin.deleteUser(id)
    if (error) throw error
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(customer: TestCustomer): Promise<TestCustomerRow> {
    const { data, error } = await this.client
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
    const { data, error } = await this.client.from('customers').select('id').eq('email', email)
    if (error) throw error
    await this.removeCustomers(data.map(row => row.id))
  }

  /**
   * Orders reference their customer without a cascade, so their orders go
   * first (jobs, files and history follow those by cascade), then the customers.
   */
  private async removeCustomers(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { error: orderError } = await this.client.from('orders').delete().in('customer_id', ids)
    if (orderError) throw orderError
    const { error: customerError } = await this.client.from('customers').delete().in('id', ids)
    if (customerError) throw customerError
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  /**
   * Inserts an order for an existing customer in the given state. `order_number`
   * is assigned by the trg_order_number trigger, so it is left out of the payload
   * (as the app's NewOrderDialog does); `created_by` stays null under the service role.
   */
  async createOrder(customerId: string, seed: OrderSeedRow): Promise<TestOrder> {
    const payload = { customer_id: customerId, ...seed } as OrderInsert
    const { data, error } = await this.client.from('orders').insert(payload).select('id, order_number').single()
    if (error) throw error
    return { id: data.id, orderNumber: data.order_number, customerId }
  }

  /** Deletes the order; jobs, files and history follow by cascade. The customer stays. */
  async removeOrder(orderId: string): Promise<void> {
    const { error } = await this.client.from('orders').delete().eq('id', orderId)
    if (error) throw error
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────

  /**
   * Inserts a job in its initial state (the table's defaults: in setup, no
   * overrides). `job_number` is assigned by the trg_job_number trigger, so it
   * is left out of the payload. Removed with its order — no separate cleanup.
   */
  async createJob(orderId: string, department: Department): Promise<TestJob> {
    const payload = { order_id: orderId, department } as JobInsert
    const { data, error } = await this.client.from('jobs').insert(payload).select('id, job_number').single()
    if (error) throw error
    return { id: data.id, jobNumber: data.job_number, orderId, department }
  }

  // ── Products ─────────────────────────────────────────────────────────────

  /**
   * Inserts one product for a job the same way the app does: the parent row in
   * `department_products`, then the typed child row keyed by the parent's id.
   * Removed with the job (cascade) — no separate cleanup.
   */
  async createProduct(job: TestJob, seed: ProductSeed): Promise<string> {
    const { data, error } = await this.client
      .from('department_products')
      .insert({ job_id: job.id, department: job.department, type: seed.type, quantity: 1 })
      .select('id')
      .single()
    if (error) throw error
    const { error: childError } = await this.client
      .from(seed.childTable)
      .insert({ department_product_id: data.id, ...seed.child })
    if (childError) throw childError
    return data.id
  }
}
