import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, TablesInsert } from '../../src/types/supabase'
import type { DefaultAssigneeStatus } from '../../src/types/database'
import type { ChildTable } from '../../src/types/product'
import { randomBytes } from 'node:crypto'
import { addDays } from 'date-fns'
import type { ApprovalRequestSeed } from '../fixtures/approvalRequests'
import type { TestCustomer } from '../fixtures/customers'
import type { CustomerApprovalSettingsSeed } from '../fixtures/customerApprovalSettings'
import type { EmailSettingPatch, EmailSettingRow, QueuedEmailSeed, SentEmailSeed } from '../fixtures/emailMessages'
import type { TestUser } from '../fixtures/users'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type Department = Database['public']['Enums']['department']
type OrderStatus = Database['public']['Enums']['order_status']
type DeliveryType = Database['public']['Enums']['delivery_type']
type PaymentMethod = Database['public']['Enums']['payment_method']
type ProductStatus = Database['public']['Enums']['product_status']
type HistoryEvent = Database['public']['Enums']['history_event']

/** One row of list_queued_emails: a message still on the queue for an order. */
export type QueuedEmailRow = Database['public']['Functions']['list_queued_emails']['Returns'][number]

const MS_PER_DAY = 86_400_000

/**
 * How many whole days the message was queued to wait: from when it was queued
 * to when it is due. Rounded, as pgmq stamps the two a moment apart.
 */
export function queuedDelayDays(row: QueuedEmailRow): number {
  return Math.round((Date.parse(row.due_at) - Date.parse(row.queued_at)) / MS_PER_DAY)
}

/** One sent record, as much of it as a spec looks at. */
export type SentEmailRow = Pick<Database['public']['Tables']['sent_emails']['Row'], 'id' | 'provider_id' | 'recipient' | 'subject'>

/** What the provider has reported of a sent mail, as the record holds it. */
export type SentEmailDelivery = Pick<
  Database['public']['Tables']['sent_emails']['Row'],
  'delivered_at' | 'bounced_at' | 'bounce_reason' | 'complained_at'
>

/** What a spec gets to know about the sent record the fixture inserted for it. */
export type TestSentEmail = {
  id: string
  /** The id the provider would have assigned the mail — what a delivery report names it by. */
  providerId: string
  orderId: string
}

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

/** One approval round, as the database holds it. */
export type ApprovalRequestRow = Database['public']['Tables']['product_approval_requests']['Row']

/** What a spec gets to know about the approval request the fixture inserted for it. */
export type TestApprovalRequest = {
  id: string
  productId: string
  orderId: string
  round: number
}

/** A product's workflow columns, as much of them as a spec reads back after a refused or an allowed write. */
export type ProductState = Pick<Database['public']['Tables']['products']['Row'], 'status' | 'quantity' | 'deadline' | 'assignee_id'>

/** One history entry's product and details, for what an event recorded. */
export type HistoryEntryRow = Pick<Database['public']['Tables']['history']['Row'], 'product_id' | 'meta'>

/** One automatic stock movement, as much of it as a spec looks at. */
export type StockMovementRow = Pick<Database['public']['Tables']['stamp_stock_movements']['Row'], 'quantity' | 'note'>

/** How long a seeded request stays valid — the setting's shipped default. */
const SEEDED_REQUEST_VALIDITY_DAYS = 14

export function requiredEnv(name: string): string {
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

  /**
   * A connection that writes as one of the suite's logins would — the anon
   * key plus that user's session, so RLS and the `authenticated` guards apply.
   * For the rules the database enforces on the app but not on the runner,
   * which the service-role connection above is exempt from.
   */
  async asUser(user: TestUser): Promise<SupabaseClient<Database>> {
    const client = createClient<Database>(
      requiredEnv('VITE_SUPABASE_URL'),
      requiredEnv('VITE_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
    if (error) throw error
    return client
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

  // ── Customer approval settings ───────────────────────────────────────────

  /** Writes the customer approval's settings onto the one row, replacing whatever it held. */
  async updateCustomerApprovalSettings(seed: CustomerApprovalSettingsSeed): Promise<void> {
    const { error } = await this.client.from('customer_approval_settings').update(seed).eq('id', true)
    if (error) throw error
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

  /** When a mail to the customer's current address last bounced; null while none has. */
  async customerEmailBouncedAt(customerId: string): Promise<string | null> {
    const { data, error } = await this.client.from('customers').select('email_bounced_at').eq('id', customerId).single()
    if (error) throw error
    return data.email_bounced_at
  }

  /** Changes the customer's email address, as saving the customer dialog with another one would. */
  async updateCustomerEmail(customerId: string, email: string): Promise<void> {
    const { error } = await this.client.from('customers').update({ email }).eq('id', customerId)
    if (error) throw error
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

  /** The product's workflow columns as stored. */
  async productState(productId: string): Promise<ProductState> {
    const { data, error } = await this.client
      .from('products')
      .select('status, quantity, deadline, assignee_id')
      .eq('id', productId)
      .single()
    if (error) throw error
    return data
  }

  /** Hands the product to the login, as picking them in the assignee picker would. Returns the user's id. */
  async assignProduct(productId: string, user: TestUser): Promise<string> {
    const userId = await this.userId(user)
    const { error } = await this.client.from('products').update({ assignee_id: userId }).eq('id', productId)
    if (error) throw error
    return userId
  }

  // ── Customer approval ────────────────────────────────────────────────────

  /**
   * Inserts one approval round for the product over the file, as the request
   * RPC would have left it: the request row with a token hash of its own, the
   * file row with the copy's path, and — for a pending round — the product in
   * awaiting approval. Nothing is queued and nothing is stored in the bucket.
   * Removed with the order by cascade.
   */
  async createApprovalRequest(
    product: TestProduct,
    file: TestFile,
    seed: ApprovalRequestSeed,
    requestedBy: TestUser,
  ): Promise<TestApprovalRequest> {
    const id = crypto.randomUUID()
    const { data: previous, error: roundError } = await this.client
      .from('product_approval_requests')
      .select('round')
      .eq('product_id', product.id)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (roundError) throw roundError
    const round = (previous?.round ?? 0) + 1

    const { error } = await this.client.from('product_approval_requests').insert({
      id,
      product_id: product.id,
      round,
      message: seed.message,
      token_hash: randomBytes(32).toString('hex'),
      status: seed.status,
      mailed: seed.mailed,
      expires_at: addDays(new Date(), SEEDED_REQUEST_VALIDITY_DAYS).toISOString(),
      requested_by: await this.userId(requestedBy),
    })
    if (error) throw error

    const { error: fileError } = await this.client.from('product_approval_request_files').insert({
      request_id: id,
      file_id: file.id,
      storage_path: `${product.orderId}/${id}/${file.id}-${file.display_name}`,
    })
    if (fileError) throw fileError

    if (seed.status === 'PENDING') {
      const { error: statusError } = await this.client
        .from('products')
        .update({ status: 'AWAITING_APPROVAL' })
        .eq('id', product.id)
      if (statusError) throw statusError
    }

    return { id, productId: product.id, orderId: product.orderId, round }
  }

  /** The product's approval rounds, newest first. */
  async approvalRequests(productId: string): Promise<ApprovalRequestRow[]> {
    const { data, error } = await this.client
      .from('product_approval_requests')
      .select('*')
      .eq('product_id', productId)
      .order('round', { ascending: false })
    if (error) throw error
    return data
  }

  /** The files of one approval round. */
  async approvalRequestFileIds(requestId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('product_approval_request_files')
      .select('file_id')
      .eq('request_id', requestId)
    if (error) throw error
    return data.map(row => row.file_id)
  }

  /** The request a link's token belongs to, looked up as the customer's page does — by the token's hash. */
  async approvalRequestIdByTokenHash(tokenHash: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('product_approval_requests')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }

  // ── Stock ────────────────────────────────────────────────────────────────

  /** The stamp model's stock as stored. */
  async stampModelStock(modelId: string): Promise<number> {
    const { data, error } = await this.client.from('stamp_models').select('stock').eq('id', modelId).single()
    if (error) throw error
    return data.stock
  }

  /** The automatic movements booked against the stamp model. */
  async stampStockMovements(modelId: string): Promise<StockMovementRow[]> {
    const { data, error } = await this.client
      .from('stamp_stock_movements')
      .select('quantity, note')
      .eq('model_id', modelId)
      .eq('type', 'AUTO_DEDUCTION')
    if (error) throw error
    return data
  }

  // ── Emails ───────────────────────────────────────────────────────────────

  /** Queues a message for the order through queue_email, as a trigger would. Returns the queue message id. */
  async queueEmail(orderId: string, seed: QueuedEmailSeed): Promise<number> {
    const msgId = await this.tryQueueEmail(orderId, seed)
    if (msgId === null) throw new Error(`queue_email queued nothing for ${seed.template} — is the template disabled?`)
    return msgId
  }

  /** The same call, returning null where queue_email queued nothing (the template is switched off). */
  async tryQueueEmail(orderId: string, seed: QueuedEmailSeed): Promise<number | null> {
    const { data, error } = await this.client.rpc('queue_email', {
      template: seed.template,
      order_id: orderId,
      product_id: undefined,
      // A seed's context is plain JSON data; the generated type wants it spelled as Json.
      context: seed.context as Json,
      // Left out when null, so queue_email takes the template's delay from Settings.
      delay_seconds: seed.delaySeconds ?? undefined,
    })
    if (error) throw error
    return data
  }

  /** The messages still on the queue for the order — waiting, or claimed and due to come back. */
  async queuedEmails(orderId: string): Promise<QueuedEmailRow[]> {
    const { data, error } = await this.client.rpc('list_queued_emails', { order_id: orderId })
    if (error) throw error
    return data
  }

  /** Makes the message due now, in place of waiting out its delay or its visibility timeout. */
  async makeEmailDue(msgId: number): Promise<void> {
    const { error } = await this.client.rpc('reschedule_email', { msg_id: msgId, delay_seconds: 0 })
    if (error) throw error
  }

  /** Makes every message still on the queue for the order due now — a repeat the sender queued, for one. */
  async makeQueuedEmailsDue(orderId: string): Promise<void> {
    const queued = await this.queuedEmails(orderId)
    await Promise.all(queued.map(row => this.makeEmailDue(row.msg_id)))
  }

  /** Takes the message off the queue whether or not it was sent; nothing happens when it is gone already. */
  async archiveEmail(msgId: number): Promise<void> {
    const { error } = await this.client.rpc('archive_email', { msg_id: msgId })
    if (error) throw error
  }

  /** Takes every message still on the queue for the order off it — the one a test queued and any repeat the sender added. */
  async archiveQueuedEmails(orderId: string): Promise<void> {
    const queued = await this.queuedEmails(orderId)
    await Promise.all(queued.map(row => this.archiveEmail(row.msg_id)))
  }

  /** The template's row in Settings → Emails, as stored; fails when the template has none. */
  async emailSetting(template: string): Promise<EmailSettingRow> {
    const { data, error } = await this.client.from('email_settings').select('*').eq('template', template).single()
    if (error) throw error
    return data
  }

  /** Changes switches or wording on the template's row. */
  async updateEmailSetting(template: string, patch: EmailSettingPatch): Promise<void> {
    const { error } = await this.client.from('email_settings').update(patch).eq('template', template)
    if (error) throw error
  }

  /** Writes a row read earlier back as it was. */
  async restoreEmailSetting(row: EmailSettingRow): Promise<void> {
    const { error } = await this.client.from('email_settings').upsert(row)
    if (error) throw error
  }

  /**
   * Inserts a sent record for the order as the sender writes one after the
   * provider accepted the mail — with a fresh provider id in place of
   * Resend's, and a queue message id below zero, outside pgmq's range, so it
   * cannot collide with a message the sender records. Removed with the order
   * by cascade.
   */
  async createSentEmail(orderId: string, seed: SentEmailSeed): Promise<TestSentEmail> {
    const providerId = crypto.randomUUID()
    const { data, error } = await this.client
      .from('sent_emails')
      .insert({
        order_id: orderId,
        queue_msg_id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        provider_id: providerId,
        ...seed,
      })
      .select('id')
      .single()
    if (error) throw error
    return { id: data.id, providerId, orderId }
  }

  /** What the provider has reported of the sent mail so far. */
  async sentEmailDelivery(sentEmailId: string): Promise<SentEmailDelivery> {
    const { data, error } = await this.client
      .from('sent_emails')
      .select('delivered_at, bounced_at, bounce_reason, complained_at')
      .eq('id', sentEmailId)
      .single()
    if (error) throw error
    return data
  }

  /** The sent records of the order. */
  async sentEmails(orderId: string): Promise<SentEmailRow[]> {
    const { data, error } = await this.client
      .from('sent_emails')
      .select('id, provider_id, recipient, subject')
      .eq('order_id', orderId)
    if (error) throw error
    return data
  }

  /** The html bodies of the order's sent mails, as they went out. */
  async sentEmailBodies(orderId: string): Promise<string[]> {
    const { data, error } = await this.client.from('sent_emails').select('body_html').eq('order_id', orderId)
    if (error) throw error
    return data.map(row => row.body_html)
  }

  /** The order's history entries of that event, with what each recorded. */
  async historyEntries(orderId: string, eventType: HistoryEvent): Promise<HistoryEntryRow[]> {
    const { data, error } = await this.client
      .from('history')
      .select('product_id, meta')
      .eq('order_id', orderId)
      .eq('event_type', eventType)
    if (error) throw error
    return data
  }

  /** How many history entries of that event the order has. */
  async historyCount(orderId: string, eventType: HistoryEvent): Promise<number> {
    const { count, error } = await this.client
      .from('history')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('event_type', eventType)
    if (error) throw error
    return count ?? 0
  }

  /** The access token of one of the suite's logins — a user's session, as the app would present it. */
  async accessTokenOf(user: TestUser): Promise<string> {
    const client = await this.asUser(user)
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    if (!data.session) throw new Error(`No session for ${user.email} after signing in`)
    return data.session.access_token
  }
}
