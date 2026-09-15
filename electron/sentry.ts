import { app } from 'electron'
import * as Sentry from '@sentry/electron/main'

/**
 * Sentry for the Electron main process.
 *
 * Must run before `app.whenReady()` and before any other
 * `protocol.registerSchemesAsPrivileged` call: the SDK registers its own
 * `sentry-ipc://` scheme (the renderer's fallback transport) and proxies later
 * scheme registrations so they merge instead of overwrite.
 *
 * The DSN is baked in at build time from `VITE_SENTRY_DSN` (see `.env.example`).
 * With an empty DSN the SDK is not started at all.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? ''
  if (dsn === '') return

  Sentry.init({
    dsn,
    release: `print-and-more@${app.getVersion()}`,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || (app.isPackaged ? 'production' : 'development'),
    sendDefaultPii: false,
    // Performance tracing is opt-in: set `tracesSampleRate` here when wanted.
  })
}
