// Brings AhaSend's delivery reports to the local email-webhook function, for
// development: `npm run email:webhook`, and started alongside Vite by
// `npm run dev`.
//
// AhaSend cannot post to localhost, so its CLI streams the events instead
// (`ahasend webhooks listen`) and forwards each one, signed, to a local URL.
// The CLI signs with a secret of its own, new on every run, while the local
// function verifies against EMAIL_WEBHOOK_SECRET from supabase/functions/.env,
// read once when it starts. So the CLI forwards to a relay here: the relay
// reads the run's secret from the CLI's banner, refuses an event that does
// not carry its signature, signs the raw body again with
// EMAIL_WEBHOOK_SECRET — AhaSend's scheme: Standard Webhooks headers, the
// secret's UTF-8 bytes as the HMAC key — and posts it to the function, which
// then needs no restart.
//
// Needs the AhaSend CLI logged in (`ahasend auth login`) with a key that has
// the webhook scopes, and the local Supabase running. Without a webhook id
// the CLI creates a temporary webhook on every run; it receives every event
// of the account, production mail included, which the local function finds
// no record for and acknowledges.
//
//   EMAIL_WEBHOOK_LISTEN_ID      an existing AhaSend webhook to listen
//                                through, instead of a temporary one per run
//   EMAIL_WEBHOOK_FUNCTION_URL   where the function is served; default the
//                                local API from supabase/config.toml
//   EMAIL_WEBHOOK_RELAY_PORT     the relay's own port; default 55399

import { spawn } from 'node:child_process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const FUNCTIONS_ENV = path.join(ROOT, 'supabase/functions/.env')

if (fs.existsSync(FUNCTIONS_ENV)) process.loadEnvFile(FUNCTIONS_ENV)

const FUNCTION_URL = process.env.EMAIL_WEBHOOK_FUNCTION_URL ?? 'http://127.0.0.1:55321/functions/v1/email-webhook'
const RELAY_PORT = Number(process.env.EMAIL_WEBHOOK_RELAY_PORT ?? 55399)
const FUNCTION_SECRET = process.env.EMAIL_WEBHOOK_SECRET
const WEBHOOK_ID = process.env.EMAIL_WEBHOOK_LISTEN_ID

/** How the CLI announces the secret it signs forwarded events with. */
const BANNER_SECRET = /Forwarding secret \(signs forwarded events\):\s*(\S+)/

if (!FUNCTION_SECRET) {
  console.error(`EMAIL_WEBHOOK_SECRET is not set in ${path.relative(ROOT, FUNCTIONS_ENV)}; no report could be verified.`)
  process.exit(1)
}

function sign(secret, id, timestamp, body) {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(`${id}.${timestamp}.${body}`).digest('base64')
}

/** Whether any `v1,` entry of the header is the CLI's signature of the body. */
function signedByCli(secret, headers, body) {
  const id = headers['webhook-id']
  const timestamp = headers['webhook-timestamp']
  const presented = headers['webhook-signature']
  if (!id || !timestamp || !presented) return false
  const expected = Buffer.from(sign(secret, id, timestamp, body))
  return presented
    .split(' ')
    .map(entry => entry.split(',', 2))
    .some(([version, value]) => {
      if (version !== 'v1' || !value) return false
      const candidate = Buffer.from(value)
      return candidate.length === expected.length && timingSafeEqual(candidate, expected)
    })
}

let cliSecret = null

const relay = http.createServer((req, res) => {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', async () => {
    const body = Buffer.concat(chunks).toString('utf8')
    if (!cliSecret || !signedByCli(cliSecret, req.headers, body)) {
      console.warn('relay: refused a request not signed by this run of the CLI')
      res.writeHead(401).end()
      return
    }
    const id = req.headers['webhook-id']
    const timestamp = String(Math.floor(Date.now() / 1000))
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'webhook-id': id,
          'webhook-timestamp': timestamp,
          'webhook-signature': `v1,${sign(FUNCTION_SECRET, id, timestamp, body)}`,
        },
        body,
      })
      const answer = await response.text()
      console.log(`relay: email-webhook answered ${response.status} ${answer}`)
      res.writeHead(response.status, { 'Content-Type': 'application/json' }).end(answer)
    } catch (error) {
      console.error(`relay: could not reach ${FUNCTION_URL}: ${error.message} — is the local Supabase running?`)
      res.writeHead(502).end()
    }
  })
})

relay.listen(RELAY_PORT, '127.0.0.1', () => {
  const relayUrl = `http://127.0.0.1:${RELAY_PORT}/`
  console.log(`relay: forwarding to ${FUNCTION_URL}`)

  const args = ['webhooks', 'listen', '--forward-to', relayUrl, ...(WEBHOOK_ID ? ['--webhook-id', WEBHOOK_ID] : [])]
  const cli = spawn('ahasend', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const passThrough = (stream, target) =>
    stream.on('data', chunk => {
      target.write(chunk)
      const match = chunk.toString().match(BANNER_SECRET)
      if (match) cliSecret = match[1]
    })
  passThrough(cli.stdout, process.stdout)
  passThrough(cli.stderr, process.stderr)

  cli.on('error', error => {
    console.error(
      error.code === 'ENOENT'
        ? 'The AhaSend CLI is not installed: https://ahasend.com/docs/cli/installation.md'
        : `Could not start the AhaSend CLI: ${error.message}`,
    )
    relay.close()
    process.exitCode = 1
  })
  cli.on('exit', code => {
    relay.close()
    process.exitCode = code ?? 0
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => cli.kill(signal))
})
