import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '../../src/types/supabase'
import type { DefaultAssigneeStatus } from '../../src/types/database'
import type { ChildTable } from '../../src/types/product'
import type { TestCustomer } from '../fixtures/customers'
import type { TestUser } from '../fixtures/users'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type Department = Database['public']['Enums']['department']
type OrderStatus = Database['public']['Enums']['order_status']
type DeliveryType = Database['public']['Enums']['delivery_type']
type PaymentMethod = Database['public']['Enums']['payment_method']
type ProductStatus = Database['public']['Enums']['product_status']

/** The columns a fixture chooses for an order it inserts; everything else takes the table's defaults. */
export type OrderSeedRow = {
  status: OrderStatus
  deadline: string | null
  delivery: DeliveryType | null
  payment_method: PaymentMethod
}

/** The columns a fixture chooses for a file it links to an order. */
export type FileSeedRow = {
  display_name: string
  path: string
  role: Database['public']['Enums']['file_role']
}

/** The columns a fixture chooses for a stamp model in the catalog; the id is fixed so products can reference it. */
export type StampModelSeedRow = {
  id: string
  name: string
  type: string
  stock: number
}

/** A brand → model → variant chain in the textile catalog; ids are fixed so a garment line can reference the variant. */
export type TextileChainSeed = {
  brand: { id: string; name: string }
  model: { id: string; brand_id: string; name: string }
  variant: { id: string; model_id: string; color: string; size: string; stock: number }
}

/** What a spec gets to know about the file the fixture linked for it. */
export type TestFile = FileSeedRow & { id: string; orderId: string }

/** The parent columns a fixture chooses for a product; everything else takes the table's defaults. */
export type ProductSeedRow = {
  department: Department
  /** The discriminator that selects the child table; guarded against the department by trg_product_type_check. */
  type: string
  status: ProductStatus
  /** Null for a textile batch, whose pieces are counted on its garment lines. */
  quantity: number | null
  customer_approval_required: boolean
}

/**
 * The typed child row of a single-child product type, distributed over the
 * child tables so `child` is typed by the `childTable` chosen.
 */
export type ProductChildSeed = {
  [T in ChildTable]: {
    childTable: T
    child: Omit<TablesInsert<T>, 'product_id'>
  }
}[ChildTable]

/** A textile batch's two 1:n children, in place of one typed child row. */
export type TextileBatchSeed = {
  garments: Omit<TablesInsert<'textile_garments'>, 'product_id'>[]
  designs: Omit<TablesInsert<'textile_designs'>, 'product_id'>[]
}

/**
 * What a fixture inserts for one product: the parent columns plus its
 * children — one typed child row, or a textile batch's garment lines and
 * designs. The two arms are told apart by `childTable`.
 */
export type ProductSeed = ProductSeedRow & (ProductChildSeed | TextileBatchSeed)

/** What a spec gets to know about the customer the fixture inserted for it. */
export type TestCustomerRow = TestCustomer & { id: string }

/** What a spec gets to know about the order the fixture created for it. */
export type TestOrder = {
  id: string
  orderNumber: string
  customerId: string
}

/** What a spec gets to know about the product the fixture created for it. */
export type TestProduct = {
  id: string
  productNumber: string
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

  /** The id of one of the suite's logins (created by global setup). */
  async userId(user: TestUser): Promise<string> {
    const id = await this.findUserId(user.email)
    if (!id) throw new Error(`Test user ${user.email} does not exist — did global setup run?`)
    return id
  }

  /** Marks or unmarks the login as a developer account (hidden from the assignee pickers). Returns the user's id. */
  async setDeveloper(user: TestUser, isDeveloper: boolean): Promise<string> {
    const userId = await this.userId(user)
    const { error } = await this.client.from('users').update({ is_developer: isDeveloper }).eq('id', userId)
    if (error) throw error
    return userId
  }

  // ── Department defaults ──────────────────────────────────────────────────

  /** Puts the user into the department's slot for that stage, replacing whoever held it. Returns the user's id. */
  async setDepartmentDefault(department: Department, status: DefaultAssigneeStatus, user: TestUser): Promise<string> {
    const userId = await this.userId(user)
    const { error } = await this.client
      .from('department_default_assignees')
      .upsert({ department, status, user_id: userId }, { onConflict: 'department,status' })
    if (error) throw error
    return userId
  }

  /** Empties the slot; nothing happens when it already is. */
  async removeDepartmentDefault(department: Department, status: DefaultAssigneeStatus): Promise<void> {
    const { error } = await this.client
      .from('department_default_assignees')
      .delete()
      .eq('department', department)
      .eq('status', status)
    if (error) throw error
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(customer: TestCustomer): Promise<TestCustomerRow> {
    const { data, error } = await this.client
      .from('customers')
      .insert({
        name: customer.name,
        email: customer.email,
        phone: customer.phone ?? null,
        street: customer.street ?? null,
        house_number: customer.houseNumber ?? null,
        postal_code: customer.postalCode ?? null,
        city: customer.city ?? null,
      })
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
   * first (products, files and history follow those by cascade), then the
   * customers.
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

  /** Deletes the order; products, files and history follow by cascade. The customer stays. */
  async removeOrder(orderId: string): Promise<void> {
    const { error } = await this.client.from('orders').delete().eq('id', orderId)
    if (error) throw error
  }

  // ── Files ────────────────────────────────────────────────────────────────

  /** Links a file to an order (a row only — nothing is stored on disk). Removed with the order by cascade. */
  async createFile(orderId: string, seed: FileSeedRow): Promise<TestFile> {
    const { data, error } = await this.client
      .from('files')
      .insert({ order_id: orderId, ...seed })
      .select('id')
      .single()
    if (error) throw error
    return { ...seed, id: data.id, orderId }
  }

  // ── Catalog ──────────────────────────────────────────────────────────────

  /** Inserts the stamp model, or resets it to the seed (stock included) if it is already there. */
  async upsertStampModel(seed: StampModelSeedRow): Promise<void> {
    const { error } = await this.client.from('stamp_models').upsert(seed)
    if (error) throw error
  }

  /**
   * Deletes the stamp model with the movements booked against it (a release
   * writes those, and they block the delete); products that referenced it
   * lose the reference (set null).
   */
  async removeStampModel(id: string): Promise<void> {
    const { error: movementError } = await this.client.from('stamp_stock_movements').delete().eq('model_id', id)
    if (movementError) throw movementError
    const { error } = await this.client.from('stamp_models').delete().eq('id', id)
    if (error) throw error
  }

  /** Inserts the brand, model and variant, or resets them to the seed (stock included) if already there. */
  async upsertTextileChain(seed: TextileChainSeed): Promise<void> {
    const { error: brandError } = await this.client.from('textile_brands').upsert(seed.brand)
    if (brandError) throw brandError
    const { error: modelError } = await this.client.from('textile_models').upsert(seed.model)
    if (modelError) throw modelError
    const { error: variantError } = await this.client.from('textile_variants').upsert(seed.variant)
    if (variantError) throw variantError
  }

  /** Deletes the chain leaf first, with the movements booked against the variant; garment lines that referenced it lose the reference. */
  async removeTextileChain(seed: TextileChainSeed): Promise<void> {
    const { error: movementError } = await this.client.from('textile_stock_movements').delete().eq('variant_id', seed.variant.id)
    if (movementError) throw movementError
    const { error: variantError } = await this.client.from('textile_variants').delete().eq('id', seed.variant.id)
    if (variantError) throw variantError
    const { error: modelError } = await this.client.from('textile_models').delete().eq('id', seed.model.id)
    if (modelError) throw modelError
    const { error: brandError } = await this.client.from('textile_brands').delete().eq('id', seed.brand.id)
    if (brandError) throw brandError
  }

  // ── Products ─────────────────────────────────────────────────────────────

  /**
   * Inserts one product for an order the same way the app does: the parent row
   * in `products`, then the children keyed by the parent's id — one typed
   * child row, or a textile batch's garment lines and designs.
   * `product_number` is assigned by the trg_product_number trigger, so it is
   * left out of the payload. Removed with its order (cascade) — no separate
   * cleanup.
   */
  async createProduct(orderId: string, seed: ProductSeed): Promise<TestProduct> {
    const payload = {
      order_id: orderId,
      department: seed.department,
      type: seed.type,
      status: seed.status,
      quantity: seed.quantity,
      customer_approval_required: seed.customer_approval_required,
    } as ProductInsert
    const { data, error } = await this.client
      .from('products')
      .insert(payload)
      .select('id, product_number')
      .single()
    if (error) throw error

    if ('childTable' in seed) {
      const { error: childError } = await this.client
        .from(seed.childTable)
        .insert({ product_id: data.id, ...seed.child })
      if (childError) throw childError
    } else {
      if (seed.garments.length > 0) {
        const { error: garmentError } = await this.client
          .from('textile_garments')
          .insert(seed.garments.map(garment => ({ product_id: data.id, ...garment })))
        if (garmentError) throw garmentError
      }
      if (seed.designs.length > 0) {
        const { error: designError } = await this.client
          .from('textile_designs')
          .insert(seed.designs.map(design => ({ product_id: data.id, ...design })))
        if (designError) throw designError
      }
    }

    return { id: data.id, productNumber: data.product_number, orderId, department: seed.department }
  }
}
