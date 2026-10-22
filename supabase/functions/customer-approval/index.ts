// customer-approval — the server half of the customer's approval page.
//
// The approval mail links to the customer app's static page,
// `/approval#<token>`; that page reads the token from the fragment and talks
// to this function, which does everything that needs the service role. There
// is no Supabase session behind any call — the token is the whole
// authentication, so verify_jwt is off for this function and the token is
// checked here, against the SHA-256 create_approval_request stored.
//
//   GET  ?token=…                read the request: order, product, message,
//                                files, expiry, and the outcome once decided.
//                                Mutates nothing — mail gateways open every
//                                link in a message before the customer does.
//   GET  ?token=…&file=<id>      one proof, streamed from the approval-proofs
//                                bucket as an attachment. Served while the
//                                request is pending or decided, never once it
//                                expired or was withdrawn, nor after the
//                                retention purge.
//   POST { token, decision, note }  the customer's answer, through
//                                settle_approval_request_by_token; answers
//                                the request as it now stands. A request
//                                already decided answers the same way, so the
//                                page shows the outcome instead of an error.
//   OPTIONS                      the CORS preflight.
//
// JSON in and out, never HTML: the page is the customer app's. Every answer
// carries CORS headers for the customer app's origin, CUSTOMER_APP_URL. That
// one origin is not covered by the e2e suite: the local gateway answers the
// preflight itself and rewrites the allowed origin to `*`, so the header the
// function sets is only observable on the hosted project. The shapes are
// contract.ts, which the customer app mirrors in its lib/api.ts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { productLabel } from '../_shared/productLabel.ts'
import {
  MAX_NOTE_LENGTH,
  type ApprovalDecision,
  type ApprovalDecisionBody,
  type ApprovalError,
  type ApprovalFile,
  type ApprovalStatus,
  type ApprovalView,
} from './contract.ts'

const BUCKET = 'approval-proofs'

/** A token create_approval_request mints: 32 random bytes as hex. Anything else is not one, and is not looked up. */
const TOKEN_RE = /^[0-9a-f]{64}$/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The statuses whose proofs are still served. */
const SERVED_STATUSES: ReadonlySet<ApprovalStatus> = new Set<ApprovalStatus>(['PENDING', 'APPROVED', 'CHANGES_REQUESTED'])

const DECISIONS: ReadonlySet<string> = new Set<ApprovalDecision>(['APPROVED', 'CHANGES_REQUESTED'])

/** A to-one join, which Supabase may hand back as a one-element array. */
type Joined<T> = T | T[] | null

interface ProductRecord {
  product_number: string
  type: string
  orders: Joined<{ order_number: string }>
}

interface RequestFileRecord {
  file_id: string
  storage_path: string
  purged_at: string | null
  files: Joined<{ display_name: string }>
}

/** The request as this function reads it, joined to its product, order and files. */
interface RequestRecord {
  id: string
  status: ApprovalStatus
  message: string | null
  note: string | null
  responded_at: string | null
  expires_at: string
  products: Joined<ProductRecord>
  product_approval_request_files: RequestFileRecord[]
}

// The product is named by its foreign key: products.approved_request_id points
// back at this table, so a bare `products` is ambiguous to PostgREST.
const REQUEST_COLUMNS =
  'id, status, message, note, responded_at, expires_at, ' +
  'products!product_approval_requests_product_id_fkey(product_number, type, orders(order_number)), ' +
  'product_approval_request_files(file_id, storage_path, purged_at, files(display_name))'

function requiredVariable(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`customer-approval: ${name} is not set`)
  return value
}

// Read once, when the function starts, so a missing variable shows on the
// first call after deploy rather than in a customer's browser later.
const SUPABASE_URL = requiredVariable('SUPABASE_URL')
const SERVICE_ROLE_KEY = requiredVariable('SUPABASE_SERVICE_ROLE_KEY')
const ALLOWED_ORIGIN = new URL(requiredVariable('CUSTOMER_APP_URL')).origin

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Answers ───────────────────────────────────────────────────────────────────

/** On every answer: the customer app may read it, and nothing is cached — the token is in the URL. */
function commonHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  }
}

function json(status: number, body: ApprovalView | ApprovalError): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...commonHeaders(), 'Content-Type': 'application/json' },
  })
}

function notFound(): Response {
  return json(404, { error: 'not_found' })
}

function invalidRequest(detail: string): Response {
  return json(400, { error: 'invalid_request', detail })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── The request ───────────────────────────────────────────────────────────────

/** SHA-256 of the token's UTF-8 text, hex — how create_approval_request stored it. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function one<T>(joined: Joined<T>): T | null {
  return Array.isArray(joined) ? (joined[0] ?? null) : joined
}

async function findRequest(token: string): Promise<RequestRecord | null> {
  if (!TOKEN_RE.test(token)) return null
  const { data, error } = await db
    .from('product_approval_requests')
    .select(REQUEST_COLUMNS)
    .eq('token_hash', await hashToken(token))
    .maybeSingle()
  if (error) throw new Error(`request lookup failed: ${error.message}`)
  return data as RequestRecord | null
}

/**
 * The status the customer sees. A pending request past its expiry is
 * expired, though the daily expiry run has not closed it yet: the link stops
 * working at expires_at.
 */
function statusOf(request: RequestRecord): ApprovalStatus {
  if (request.status === 'PENDING' && Date.parse(request.expires_at) <= Date.now()) return 'EXPIRED'
  return request.status
}

/** The request's files the customer may still download. */
function servedFiles(request: RequestRecord): RequestFileRecord[] {
  if (!SERVED_STATUSES.has(statusOf(request))) return []
  return request.product_approval_request_files.filter(file => file.purged_at === null)
}

function view(request: RequestRecord): ApprovalView {
  const product = one(request.products)
  const order = one(product?.orders ?? null)
  const status = statusOf(request)

  const files: ApprovalFile[] = servedFiles(request)
    .map(file => ({ id: file.file_id, display_name: one(file.files)?.display_name ?? file.file_id }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))

  const answer: ApprovalView = {
    status,
    order_number: order?.order_number ?? '',
    product_number: product?.product_number ?? '',
    product_label: productLabel(product?.type ?? ''),
    message: request.message,
    files,
    expires_at: request.expires_at,
  }
  if (status !== 'PENDING') {
    answer.outcome = {
      decision: status,
      note: request.note,
      responded_at: request.responded_at ?? request.expires_at,
    }
  }
  return answer
}

// ── GET ───────────────────────────────────────────────────────────────────────

/** `attachment` with the file's name, plus an ASCII fallback for clients that ignore `filename*`. */
function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Streams the copy from the bucket through the Storage API with the service
 * role. The body is passed on as it arrives, not read into memory first.
 */
async function streamFile(request: RequestRecord, fileId: string): Promise<Response> {
  const file = servedFiles(request).find(candidate => candidate.file_id === fileId)
  if (!file) return notFound()

  const objectPath = file.storage_path.split('/').map(encodeURIComponent).join('/')
  const stored = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${objectPath}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  })
  if (stored.status === 400 || stored.status === 404) {
    await stored.body?.cancel()
    console.warn('customer-approval: copy missing from the bucket', { requestId: request.id, fileId })
    return notFound()
  }
  if (!stored.ok || !stored.body) {
    throw new Error(`storage answered ${stored.status}: ${await stored.text()}`)
  }

  const headers: Record<string, string> = {
    ...commonHeaders(),
    'Content-Type': stored.headers.get('Content-Type') ?? 'application/octet-stream',
    'Content-Disposition': contentDisposition(one(file.files)?.display_name ?? fileId),
    'Access-Control-Expose-Headers': 'Content-Disposition',
  }
  const length = stored.headers.get('Content-Length')
  if (length) headers['Content-Length'] = length
  return new Response(stored.body, { status: 200, headers })
}

async function handleGet(url: URL): Promise<Response> {
  const request = await findRequest(url.searchParams.get('token') ?? '')
  if (!request) return notFound()

  const fileId = url.searchParams.get('file')
  if (fileId === null) return json(200, view(request))
  if (!UUID_RE.test(fileId)) return notFound()
  return await streamFile(request, fileId)
}

// ── POST ──────────────────────────────────────────────────────────────────────

/** The decision the page posted, or what is wrong with it. */
function parseDecision(raw: unknown): ApprovalDecisionBody | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'the body is not an object'
  const { token, decision, note } = raw as Record<string, unknown>
  if (typeof token !== 'string') return 'token is missing'
  if (typeof decision !== 'string' || !DECISIONS.has(decision)) return 'decision must be APPROVED or CHANGES_REQUESTED'
  if (note !== undefined && note !== null && typeof note !== 'string') return 'note must be text'
  const cleanNote = typeof note === 'string' && note.trim() !== '' ? note.trim() : null
  if (cleanNote !== null && cleanNote.length > MAX_NOTE_LENGTH) return `note is longer than ${MAX_NOTE_LENGTH} characters`
  if (decision === 'CHANGES_REQUESTED' && cleanNote === null) return 'a request for changes needs a note'
  return { token, decision: decision as ApprovalDecision, note: cleanNote }
}

/** The caller's address as the gateway saw it: the first hop of x-forwarded-for. */
function callerIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || null
}

async function handlePost(req: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return invalidRequest('the body is not JSON')
  }
  const body = parseDecision(raw)
  if (typeof body === 'string') return invalidRequest(body)

  const request = await findRequest(body.token)
  if (!request) return notFound()
  // Decided, withdrawn or expired: the first answer stands, and the page shows it.
  if (statusOf(request) !== 'PENDING') return json(200, view(request))

  const { error } = await db.rpc('settle_approval_request_by_token', {
    token: body.token,
    decision: body.decision,
    note: body.note,
    ip: callerIp(req),
    user_agent: req.headers.get('user-agent'),
  })
  if (error) {
    // Lost a race with another answer, a withdrawal or the expiry: show what
    // stands. Anything else is a failure to retry.
    const current = await findRequest(body.token)
    if (current && statusOf(current) !== 'PENDING') return json(200, view(current))
    throw new Error(`settle_approval_request_by_token failed: ${error.message}`)
  }

  const settled = await findRequest(body.token)
  if (!settled) throw new Error('the settled request could not be read back')
  return json(200, view(settled))
}

// ── The endpoint ──────────────────────────────────────────────────────────────

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: commonHeaders() })

  try {
    if (req.method === 'GET') return await handleGet(new URL(req.url))
    if (req.method === 'POST') return await handlePost(req)
    return json(405, { error: 'method_not_allowed' })
  } catch (error) {
    // The cause goes to the function's log, not to a public caller.
    console.error('customer-approval: request failed', errorText(error))
    return json(500, { error: 'server_error' })
  }
})
