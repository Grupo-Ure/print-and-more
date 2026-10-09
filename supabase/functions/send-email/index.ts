// node:fs must be the first import of a function that reads static files, so
// no other module brings its own file-system polyfill (Supabase's guidance
// for static_files).
import 'node:fs'

// send-email — the email sender.
//
// For now a stub: it renders test-message and returns the result, which
// proves that the templates ship with the function, compile under the edge
// runtime and are wrapped in the shared layout. Nothing is sent. The drain
// (claim, still needed?, resolve, render, send, record, archive) replaces
// this body.
//
// Optional JSON body: { "to"?: string, "note"?: string }, passed to
// test-message as its context. Without "to" the recipient is EMAIL_SHOP_TO,
// which shows whether the runtime read the function variables.

import { createClient } from '@supabase/supabase-js'
import { renderEmail } from './render.ts'
import { TEMPLATES, type EmailMessage } from './templates/registry.ts'

async function readStubContext(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text()
  if (raw.trim() === '') return {}
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object')
  }
  const { to, note } = parsed as Record<string, unknown>
  return { to, note }
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const message: EmailMessage = {
      template: 'test-message',
      order_id: '00000000-0000-0000-0000-000000000000',
      product_id: null,
      context: await readStubContext(req),
    }
    const { recipient, data } = await TEMPLATES['test-message'].resolve(message, { db })
    const rendered = renderEmail('test-message', data)
    return json(200, { template: message.template, recipient, ...rendered })
  } catch (error) {
    console.error('send-email stub failed', error)
    return json(500, { error: error instanceof Error ? error.message : String(error) })
  }
})
