import path from 'node:path'
import { app } from 'electron'

const SCHEME = 'pam'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * OAuth callback outcome. PKCE hands back a single-use code, never a session —
 * nothing sensitive travels through the OS command line.
 */
export type AuthCallback = { ok: true; code: string } | { ok: false; error: string }

/** A recognised deep link. Anything else is dropped without trace. */
export type DeepLink = { verb: 'order'; orderId: string } | { verb: 'auth'; result: AuthCallback }

/**
 * Must be called before app.whenReady(), on every startup — Windows keeps the
 * registration per-executable and it is cheap to reassert.
 */
export function registerDeepLinkScheme(): void {
  if (process.defaultApp) {
    // Unpackaged: register electron.exe *plus* the project path, or the OS
    // launches the runtime with nothing to run.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])])
    }
    return
  }

  // The portable build runs from a temp extraction directory that changes on
  // every launch; PORTABLE_EXECUTABLE_FILE is the path the user actually ran.
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE
  if (portableExe) {
    app.setAsDefaultProtocolClient(SCHEME, portableExe)
  } else {
    app.setAsDefaultProtocolClient(SCHEME)
  }
}

/** The pam:// URL inside a process argv list, if the launch carried one. */
export function findDeepLink(argv: string[]): string | undefined {
  return argv.find(arg => arg.startsWith(`${SCHEME}://`))
}

/**
 * Strict verb-first parsing of `pam://<verb>/<rest>`. A deep link is untrusted
 * input — anything on the machine can fire one — so unknown verbs and
 * malformed payloads return null rather than reaching the renderer.
 */
export function parseDeepLink(rawUrl: string): DeepLink | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${SCHEME}:`) return null

  // The verb lands in `host`, its payload in `pathname`.
  const segments = url.pathname.split('/').filter(Boolean)

  switch (url.host) {
    case 'order': {
      const orderId = segments[0]
      if (orderId == null || !UUID.test(orderId)) return null
      return { verb: 'order', orderId }
    }

    case 'auth': {
      if (segments[0] !== 'callback') return null
      const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error')
      if (failure != null) return { verb: 'auth', result: { ok: false, error: failure } }

      const code = url.searchParams.get('code')
      if (code == null || code.length === 0) {
        return { verb: 'auth', result: { ok: false, error: 'Sign-in returned no code.' } }
      }
      return { verb: 'auth', result: { ok: true, code } }
    }

    default:
      return null
  }
}

let pendingOrderId: string | null = null

/** Latest wins — a newer link supersedes one the renderer never picked up. */
export function setPendingOrderId(orderId: string): void {
  pendingOrderId = orderId
}

/** Returns the pending order id and clears it, so it can only be acted on once. */
export function consumePendingOrderId(): string | null {
  const held = pendingOrderId
  pendingOrderId = null
  return held
}
