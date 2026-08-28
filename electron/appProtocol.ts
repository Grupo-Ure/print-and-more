import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'

const APP_SCHEME = 'app'
const APP_HOST = 'bundle'

/** The packaged renderer's origin — the stable identity all web storage hangs off. */
export const RENDERER_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/** The packaged renderer's entry URL. */
export const RENDERER_URL = `${RENDERER_ORIGIN}/index.html`

/** Must be called before app.whenReady() — Chromium only accepts scheme privileges at startup. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ])
}

/** Must be called after app.whenReady(). Serves dist/ under app://bundle/. */
export function serveRendererBundle(): void {
  const rendererDir = path.join(import.meta.dirname, '../dist')

  protocol.handle(APP_SCHEME, request => {
    const { host, pathname } = new URL(request.url)
    if (host !== APP_HOST) return new Response(null, { status: 400 })

    const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname)
    const file = path.join(rendererDir, requested)

    // Never serve anything that resolves outside the renderer bundle.
    const relative = path.relative(rendererDir, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response(null, { status: 404 })
    }

    return net.fetch(pathToFileURL(file).toString())
  })
}
