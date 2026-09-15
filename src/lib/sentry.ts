import * as Sentry from '@sentry/react'
import { init as initElectronRenderer } from '@sentry/electron/renderer'
import { authService } from '../services/authService'

/**
 * Sentry for the renderer / browser tab.
 *
 * Configuration comes from `VITE_SENTRY_*` env vars (see `.env.example`) and is
 * baked in at build time. Without a DSN nothing is initialised, so a checkout
 * with an empty `.env` never reports anywhere.
 *
 * Inside the Electron shell (`window.pam` present) events are forwarded to the
 * main process over IPC and sent from there — one release/environment, offline
 * queueing, native crash context. In a plain browser tab the React SDK talks to
 * Sentry directly.
 */

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? ''

export const isSentryEnabled = dsn !== ''

const commonOptions: Sentry.BrowserOptions = {
  dsn,
  release: `print-and-more@${__APP_VERSION__}`,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
  sendDefaultPii: false,
  // Performance tracing / session replay are opt-in: add
  // `Sentry.browserTracingIntegration()` / `Sentry.replayIntegration()` here
  // together with the matching sample rates when wanted.
  integrations: [],
}

/** Call once, before React renders. */
export function initSentry(): void {
  if (!isSentryEnabled) return

  if (window.pam != null) {
    // The second argument routes the Electron init through the React SDK so
    // React-specific pieces (ErrorBoundary, reactErrorHandler) attach correctly.
    initElectronRenderer(commonOptions, Sentry.init)
  } else {
    Sentry.init(commonOptions)
  }

  // Attribute events to the signed-in user by id only — no email, no name.
  authService.onAuthStateChange((_event, session) => {
    Sentry.setUser(session?.user ? { id: session.user.id } : null)
  })
}

/** Report an error that was handled locally (toast, retry, …) but is still worth knowing about. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryEnabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export { Sentry }
